import { Menu, nativeImage, Tray, type NativeImage } from 'electron'
import { createLogger } from './logger'
import { describeUnread } from './unread'

const log = createLogger('tray')

export interface TrayActions {
  show(): void
  hide(): void
  quit(): void
  isWindowVisible(): boolean
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
    private readonly actions: TrayActions,
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
    this.tray.on('click', () => this.actions.show())
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

    const visible = this.actions.isWindowVisible()
    tray.setImage(this.unread > 0 ? this.images.unread : this.images.normal)
    tray.setToolTip(`WhatsApp — ${describeUnread(this.unread)}`)
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: describeUnread(this.unread), enabled: false },
        { type: 'separator' },
        { label: 'Abrir WhatsApp', click: () => this.actions.show() },
        { label: 'Ocultar janela', enabled: visible, click: () => this.actions.hide() },
        { type: 'separator' },
        { label: 'Iniciar com o sistema', type: 'checkbox', checked: false, enabled: false },
        { type: 'separator' },
        { label: 'Sair', click: () => this.actions.quit() }
      ])
    )
  }

  destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) this.tray.destroy()
    this.tray = null
  }
}
