import { join } from 'node:path'
import { app, Menu, type Session } from 'electron'
import { acquireSingleInstance, installCrashLogging, installShutdownHooks } from './lifecycle'
import { createLogger } from './logger'
import { createWhatsAppSession } from './session'
import { WindowManager } from './window'

const log = createLogger('main')

let windows: WindowManager | null = null
let whatsappSession: Session | null = null

installCrashLogging()

if (!acquireSingleInstance(() => windows?.show())) {
  app.quit()
} else {
  installShutdownHooks(() => whatsappSession)

  app.on('window-all-closed', () => app.quit())

  app
    .whenReady()
    .then(() => {
      log.info(
        `starting wa-gnome ${app.getVersion()} (electron ${process.versions.electron}, ` +
          `chrome ${process.versions.chrome}, ozone ${app.commandLine.getSwitchValue('ozone-platform') || 'auto'}, ` +
          `session ${process.env['XDG_SESSION_TYPE'] ?? 'unknown'})`
      )

      if (process.env['WA_GNOME_DEBUG'] !== '1') Menu.setApplicationMenu(null)

      whatsappSession = createWhatsAppSession()
      windows = new WindowManager({
        session: whatsappSession,
        preloadPath: join(__dirname, '../preload/index.js')
      })
      windows.create()
    })
    .catch((error: unknown) => {
      log.error('fatal startup error', error)
      app.exit(1)
    })
}
