import { execFile } from 'node:child_process'
import { createLogger } from './logger'

const log = createLogger('tray-support')

export type TrayHostStatus = 'available' | 'missing' | 'unknown'

export function detectTrayHost(): Promise<TrayHostStatus> {
  return new Promise((resolve) => {
    execFile(
      'gdbus',
      [
        'call', '--session',
        '--dest', 'org.freedesktop.DBus',
        '--object-path', '/org/freedesktop/DBus',
        '--method', 'org.freedesktop.DBus.NameHasOwner',
        'org.kde.StatusNotifierWatcher'
      ],
      { timeout: 2_000 },
      (error, stdout) => {
        if (error) {
          log.warn(`could not query D-Bus for a tray host: ${error.message}`)
          resolve('unknown')
          return
        }
        resolve(stdout.includes('true') ? 'available' : 'missing')
      }
    )
  })
}
