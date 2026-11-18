import { app } from 'electron'
import { DESKTOP_ID, ICON_NAME } from '../shared/constants'
import type { CliFlags } from './cli'
import { DesktopIntegration } from './desktop-integration'
import { resolveLaunchCommand } from './launch'
import { createLogger } from './logger'
import { resourcePath } from './paths'
import { xdgDataHome } from './xdg'

const log = createLogger('desktop-entry-command')

export type DesktopEntryCommand = 'install' | 'uninstall'

export function desktopEntryCommand(flags: CliFlags): DesktopEntryCommand | null {
  if (flags.installDesktopEntry) return 'install'
  if (flags.uninstallDesktopEntry) return 'uninstall'
  return null
}

function execute(command: DesktopEntryCommand): void {
  const integration = new DesktopIntegration({
    dataHome: xdgDataHome(),
    desktopId: DESKTOP_ID,
    iconName: ICON_NAME,
    launchCommand: resolveLaunchCommand(),
    iconSourceDir: resourcePath('icons')
  })
  const files = command === 'install' ? integration.install() : integration.uninstall()
  const verb = command === 'install' ? 'installed' : 'removed'
  for (const file of files) console.log(`${verb} ${file}`)
}

export function runDesktopEntryCommand(command: DesktopEntryCommand): void {
  app
    .whenReady()
    .then(() => {
      execute(command)
      app.exit(0)
    })
    .catch((error: unknown) => {
      log.error('desktop entry operation failed', error)
      app.exit(1)
    })
}
