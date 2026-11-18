import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { STRINGS } from '../shared/strings'
import { baseDesktopFields, buildDesktopEntry, buildExec, desktopFileName } from './desktop-entry'
import { writeFileAtomic } from './fs-utils'
import { createLogger } from './logger'

const log = createLogger('desktop-integration')

export const ICON_SIZES = [32, 48, 64, 128, 256, 512] as const

export interface DesktopIntegrationOptions {
  dataHome: string
  desktopId: string
  iconName: string
  launchCommand: string[]
  iconSourceDir: string
}

export class DesktopIntegration {
  constructor(private readonly options: DesktopIntegrationOptions) {}

  get entryPath(): string {
    return join(this.options.dataHome, 'applications', desktopFileName(this.options.desktopId))
  }

  private iconPath(size: number): string {
    return join(this.options.dataHome, 'icons', 'hicolor', `${size}x${size}`, 'apps', `${this.options.iconName}.png`)
  }

  install(): string[] {
    const written = this.installIcons()
    writeFileAtomic(this.entryPath, this.buildEntry(), 0o644)
    written.push(this.entryPath)
    log.info(`installed desktop entry ${this.entryPath}`)
    return written
  }

  uninstall(): string[] {
    const removed = [this.entryPath, ...ICON_SIZES.map((s) => this.iconPath(s))].filter((p) => existsSync(p))
    for (const path of removed) rmSync(path, { force: true })
    log.info(`removed ${removed.length} desktop integration file(s)`)
    return removed
  }

  private installIcons(): string[] {
    const written: string[] = []
    for (const size of ICON_SIZES) {
      const source = join(this.options.iconSourceDir, `${size}x${size}.png`)
      if (!existsSync(source)) {
        log.warn(`missing icon ${source}`)
        continue
      }
      const target = this.iconPath(size)
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(source, target)
      written.push(target)
    }
    return written
  }

  private buildEntry(): string {
    return buildDesktopEntry({
      ...baseDesktopFields(this.options.iconName),
      Comment: STRINGS.desktopEntry.launcherComment,
      Exec: buildExec(this.options.launchCommand),
      Categories: 'Network;InstantMessaging;Chat;',
      Keywords: STRINGS.desktopEntry.keywords,
      StartupNotify: true,
      StartupWMClass: this.options.desktopId,
      SingleMainWindow: true
    })
  }
}
