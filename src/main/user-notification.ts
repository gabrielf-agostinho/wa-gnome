import { Notification } from 'electron'
import { resourcePath } from './paths'

export function notifyUser(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body, icon: resourcePath('icons', '128x128.png') }).show()
}
