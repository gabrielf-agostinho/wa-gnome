export interface CliFlags {
  hidden: boolean
  installDesktopEntry: boolean
  uninstallDesktopEntry: boolean
}

export const HIDDEN_FLAG = '--hidden'

export function parseCliFlags(argv: readonly string[]): CliFlags {
  return {
    hidden: argv.includes(HIDDEN_FLAG),
    installDesktopEntry: argv.includes('--install-desktop-entry'),
    uninstallDesktopEntry: argv.includes('--uninstall-desktop-entry')
  }
}
