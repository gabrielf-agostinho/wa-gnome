import { BrowserWindow, type Input, type Session, type WebContents } from 'electron'
import { WHATSAPP_URL } from '../shared/constants'
import { STRINGS } from '../shared/strings'
import { attachContextMenu } from './context-menu'
import { createLogger } from './logger'
import { installNavigationPolicy } from './navigation'
import { RetryScheduler } from './retry'
import { parseUnreadCount } from './unread'

const log = createLogger('window')

const ERR_ABORTED = -3

export interface WindowManagerOptions {
  session: Session
  preloadPath: string
  iconPath: string
  startHidden?: boolean
  isQuitting: () => boolean
  onVisibilityChanged?: (visible: boolean) => void
  onUnreadChanged?: (count: number) => void
  onHiddenByClose?: () => void
  onQuitRequested?: () => void
}

export function isQuitShortcut(input: Pick<Input, 'type' | 'control' | 'alt' | 'shift' | 'key'>): boolean {
  return input.type === 'keyDown' && input.control && !input.alt && !input.shift && input.key.toLowerCase() === 'q'
}

export class WindowManager {
  private window: BrowserWindow | null = null
  private readonly retry = new RetryScheduler(() => void this.load(), { initialDelayMs: 2_000, maxDelayMs: 60_000 })

  constructor(private readonly options: WindowManagerOptions) {}

  get webContents(): WebContents | null {
    return this.window?.webContents ?? null
  }

  create(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window

    const win = new BrowserWindow({
      width: 1100,
      height: 760,
      minWidth: 640,
      minHeight: 480,
      title: STRINGS.windowTitle,
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

    this.installWindowEvents(win)
    installNavigationPolicy(win.webContents)
    this.installRecovery(win.webContents)
    this.installPageObservers(win.webContents)
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

  private installWindowEvents(win: BrowserWindow): void {
    win.once('ready-to-show', () => {
      if (!this.options.startHidden) win.show()
    })

    win.on('close', (event) => {
      if (this.options.isQuitting()) return
      event.preventDefault()
      win.hide()
      this.options.onHiddenByClose?.()
    })
    win.on('show', () => this.notifyVisibility(true))
    win.on('hide', () => this.notifyVisibility(false))
    win.on('closed', () => {
      this.retry.cancel()
      this.window = null
    })
  }

  private notifyVisibility(visible: boolean): void {
    log.info(visible ? 'window shown' : 'window hidden')
    this.options.onVisibilityChanged?.(visible)
  }

  private installPageObservers(wc: WebContents): void {
    wc.on('page-title-updated', (_event, title) => {
      this.options.onUnreadChanged?.(parseUnreadCount(title))
    })

    wc.on('before-input-event', (event, input) => {
      if (!isQuitShortcut(input)) return
      event.preventDefault()
      this.options.onQuitRequested?.()
    })
  }

  private installRecovery(wc: WebContents): void {
    wc.on('did-fail-load', (_event, errorCode, errorDescription, url, isMainFrame) => {
      if (!isMainFrame || errorCode === ERR_ABORTED) return
      log.warn(`load failed (${errorCode} ${errorDescription}) for ${url}; retrying in ${this.retry.nextDelayMs}ms`)
      this.retry.schedule()
    })

    wc.on('render-process-gone', (_event, details) => {
      log.error(`renderer gone: ${details.reason} (exit ${details.exitCode})`)
      if (details.reason !== 'clean-exit') this.retry.schedule()
    })

    wc.on('unresponsive', () => log.warn('renderer unresponsive'))
    wc.on('responsive', () => log.info('renderer responsive again'))
  }

  private async load(): Promise<void> {
    const win = this.window
    if (!win) return
    try {
      await win.loadURL(WHATSAPP_URL)
      this.retry.reset()
    } catch (error) {
      log.debug('loadURL rejected', error)
    }
  }
}
