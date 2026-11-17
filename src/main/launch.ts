import { app } from 'electron'

export function resolveLaunchCommand(): string[] {
  const appImage = process.env['APPIMAGE']
  if (appImage) return [appImage]
  if (app.isPackaged) return [process.execPath]
  return [process.execPath, app.getAppPath()]
}
