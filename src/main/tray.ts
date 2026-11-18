import { Menu, nativeImage, Tray, type NativeImage } from 'electron'
import { STRINGS } from '../shared/strings'
import { createLogger } from './logger'
import { describeUnread } from './unread'

const log = createLogger('tray')

export interface WindowControls {
  show(): void
  hide(): void
  isVisible(): boolean
}

export interface AutostartToggle {
  isEnabled(): boolean
  setEnabled(enabled: boolean): void
}

export interface TrayDependencies {
  window: WindowControls
  autostart: AutostartToggle
  quit(): void
}

export interface TrayIcons {
  normal: string
  unread: string
}

export class TrayManager {
  private tray: Tray | null = null
  private unread = 0
  private readonly images: { normal: NativeImage; unread: NativeImage }

  constructor(
    private readonly deps: TrayDependencies,
    icons: TrayIcons
  ) {
    this.images = {
      normal: nativeImage.createFromPath(icons.normal),
      unread: nativeImage.createFromPath(icons.unread)
    }
    if (this.images.normal.isEmpty()) log.error(`tray icon not found: ${icons.normal}`)
  }

  create(): void {
    if (this.tray) return
    this.tray = new Tray(this.images.normal)
    this.tray.setTitle('')
    this.tray.on('click', () => this.deps.window.show())
    this.refresh()
    log.info('tray icon created')
  }

  setUnread(count: number): void {
    if (count === this.unread) return
    this.unread = count
    this.refresh()
  }

  refresh(): void {
    const tray = this.tray
    if (!tray || tray.isDestroyed()) return

    const { window, autostart } = this.deps
    const summary = describeUnread(this.unread)
    tray.setImage(this.unread > 0 ? this.images.unread : this.images.normal)
    tray.setToolTip(STRINGS.tray.tooltip(summary))
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: summary, enabled: false },
        { type: 'separator' },
        { label: STRINGS.tray.open, click: () => window.show() },
        { label: STRINGS.tray.hide, enabled: window.isVisible(), click: () => window.hide() },
        { type: 'separator' },
        {
          label: STRINGS.tray.autostart,
          type: 'checkbox',
          checked: autostart.isEnabled(),
          click: (item) => {
            autostart.setEnabled(item.checked)
            this.refresh()
          }
        },
        { type: 'separator' },
        { label: STRINGS.tray.quit, click: () => this.deps.quit() }
      ])
    )
  }

  destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) this.tray.destroy()
    this.tray = null
  }
}
