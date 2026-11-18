import { ipcMain, type IpcMainEvent, type WebContents } from 'electron'
import { IPC } from '../shared/ipc'
import { createLogger } from './logger'
import { isWhatsAppUrl } from './policy'

const log = createLogger('notifications')

export interface NotificationManagerOptions {
  getWebContents(): WebContents | null
  activate(): void
}

export class NotificationManager {
  private delivered = 0

  constructor(private readonly options: NotificationManagerOptions) {}

  start(): void {
    ipcMain.on(IPC.notificationShown, this.handleShown)
    ipcMain.on(IPC.notificationClicked, this.handleClicked)
  }

  stop(): void {
    ipcMain.removeListener(IPC.notificationShown, this.handleShown)
    ipcMain.removeListener(IPC.notificationClicked, this.handleClicked)
  }

  private readonly handleShown = (event: IpcMainEvent): void => {
    if (!this.isTrusted(event)) return
    this.delivered += 1
    log.info(`notification delivered (#${this.delivered} this session)`)
  }

  private readonly handleClicked = (event: IpcMainEvent): void => {
    if (!this.isTrusted(event)) return
    log.info('notification clicked; restoring window')
    this.options.activate()
  }

  private isTrusted(event: IpcMainEvent): boolean {
    const wc = this.options.getWebContents()
    const frame = event.senderFrame
    const ok =
      wc !== null && event.sender === wc && frame !== null && frame === wc.mainFrame && isWhatsAppUrl(frame.url)
    if (!ok) log.warn('ignored notification IPC from an untrusted sender')
    return ok
  }
}
