import { join } from 'node:path'
import { app, dialog } from 'electron'
import { APP_ID } from '../shared/constants'
import { STRINGS } from '../shared/strings'
import { Application } from './application'
import { configureBackgroundExecution, configureDesktopIdentity } from './background'
import { parseCliFlags } from './cli'
import { desktopEntryCommand, runDesktopEntryCommand } from './desktop-entry-command'
import { acquireSingleInstance, installCrashLogging, installQuitTracking } from './lifecycle'
import { createLogger, enableFileLogging, logFilePath } from './logger'
import { xdgStateHome } from './xdg'

const log = createLogger('main')

function setupFileLogging(): void {
  try {
    enableFileLogging(join(xdgStateHome(), APP_ID, 'wa-gnome.log'))
  } catch (error) {
    console.error('could not open log file', error)
  }
}

function failStartup(error: unknown): void {
  log.error('fatal startup error', error)
  const message = error instanceof Error ? error.message : String(error)
  const where = logFilePath()
  dialog.showErrorBox(STRINGS.startupError.title, where ? `${message}\n\n${STRINGS.startupError.details(where)}` : message)
  app.exit(1)
}

const flags = parseCliFlags(process.argv)

setupFileLogging()
installCrashLogging()
installQuitTracking()
configureDesktopIdentity()
configureBackgroundExecution()

const command = desktopEntryCommand(flags)
if (command) {
  runDesktopEntryCommand(command)
} else if (!acquireSingleInstance()) {
  app.quit()
} else {
  app.on('window-all-closed', () => app.quit())
  app
    .whenReady()
    .then(() => new Application({ startHidden: flags.hidden }).start())
    .catch(failStartup)
}
