import { BrowserWindow, shell, type Session } from 'electron'
import { WHATSAPP_URL } from '../shared/constants'
import { attachContextMenu } from './context-menu'
import { isQuitting } from './lifecycle'
import { createLogger } from './logger'
import { isSafeExternalUrl, isWhatsAppUrl } from './policy'
import { parseUnreadCount } from './unread'

const log = createLogger('window')

const MAX_RETRY_DELAY_MS = 60_000
const ERR_ABORTED = -3

export interface WindowManagerOptions {
  session: Session
  preloadPath: string
  iconPath: string
  startHidden?: boolean
  onVisibilityChanged?: (visible: boolean) => void
  onUnreadChanged?: (count: number) => void
  onHiddenByClose?: () => void
  onQuitRequested?: () => void
}

export class WindowManager {
  private window: BrowserWindow | null = null
  private retryDelayMs = 2_000
  private retryTimer: NodeJS.Timeout | null = null

  constructor(private readonly options: WindowManagerOptions) {}

  get browserWindow(): BrowserWindow | null {
    return this.window
  }

  create(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window

    const win = new BrowserWindow({
      width: 1100,
      height: 760,
      minWidth: 640,
      minHeight: 480,
      title: 'WhatsApp',
      icon: this.options.iconPath,
      show: false,
      paintWhenInitiallyHidden: !this.options.startHidden,
      backgroundColor: '#111b21',
      autoHideMenuBar: true,
      webPreferences: {
        session: this.options.session,
        preload: this.options.preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: true,
        backgroundThrottling: true
      }
    })
    this.window = win

    win.once('ready-to-show', () => {
      if (!this.options.startHidden) win.show()
    })

    win.on('close', (event) => {
      if (isQuitting()) return
      event.preventDefault()
      win.hide()
      this.options.onHiddenByClose?.()
    })
    win.on('show', () => this.notifyVisibility(true))
    win.on('hide', () => this.notifyVisibility(false))
    win.on('closed', () => {
      this.clearRetry()
      this.window = null
    })

    this.installNavigationPolicy(win)
    this.installRecovery(win)
    this.installPageObservers(win)
    attachContextMenu(win.webContents)

    void this.load()
    return win
  }

  show(): void {
    const win = this.create()
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }

  hide(): void {
    this.window?.hide()
  }

  isVisible(): boolean {
    return this.window?.isVisible() ?? false
  }

  private notifyVisibility(visible: boolean): void {
    log.info(visible ? 'window shown' : 'window hidden')
    this.options.onVisibilityChanged?.(visible)
  }

  private installPageObservers(win: BrowserWindow): void {
    const wc = win.webContents

    wc.on('page-title-updated', (_event, title) => {
      this.options.onUnreadChanged?.(parseUnreadCount(title))
    })

    wc.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.control && !input.alt && !input.shift && input.key.toLowerCase() === 'q') {
        event.preventDefault()
        this.options.onQuitRequested?.()
      }
    })
  }

  private async load(): Promise<void> {
    const win = this.window
    if (!win) return
    try {
      await win.loadURL(WHATSAPP_URL)
      this.retryDelayMs = 2_000
    } catch (error) {
      log.debug('loadURL rejected', error)
    }
  }

  private installNavigationPolicy(win: BrowserWindow): void {
    const wc = win.webContents

    wc.setWindowOpenHandler(({ url }) => {
      this.openExternal(url)
      return { action: 'deny' }
    })

    wc.on('will-navigate', (event, url) => {
      if (isWhatsAppUrl(url)) return
      event.preventDefault()
      this.openExternal(url)
    })

    wc.on('will-redirect', (event, url) => {
      if (isWhatsAppUrl(url)) return
      log.warn(`blocked redirect to ${url}`)
      event.preventDefault()
    })

    wc.on('will-attach-webview', (event) => event.preventDefault())
  }

  private installRecovery(win: BrowserWindow): void {
    const wc = win.webContents

    wc.on('did-fail-load', (_event, errorCode, errorDescription, url, isMainFrame) => {
      if (!isMainFrame || errorCode === ERR_ABORTED) return
      log.warn(`load failed (${errorCode} ${errorDescription}) for ${url}; retrying in ${this.retryDelayMs}ms`)
      this.scheduleRetry()
    })

    wc.on('render-process-gone', (_event, details) => {
      log.error(`renderer gone: ${details.reason} (exit ${details.exitCode})`)
      if (details.reason !== 'clean-exit') this.scheduleRetry()
    })

    wc.on('unresponsive', () => log.warn('renderer unresponsive'))
    wc.on('responsive', () => log.info('renderer responsive again'))
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return
    const delay = this.retryDelayMs
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, MAX_RETRY_DELAY_MS)
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.load()
    }, delay)
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private openExternal(url: string): void {
    if (!isSafeExternalUrl(url)) {
      log.warn(`refused to open external URL with unsafe scheme: ${url}`)
      return
    }
    shell.openExternal(url).catch((error: unknown) => log.error(`failed to open ${url}`, error))
  }
}
