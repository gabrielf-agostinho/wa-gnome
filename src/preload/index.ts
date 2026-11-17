import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import { installNotificationObserver } from './notification-observer'

contextBridge.executeInMainWorld({
  func: installNotificationObserver,
  args: [() => ipcRenderer.send(IPC.notificationShown), () => ipcRenderer.send(IPC.notificationClicked)]
})
