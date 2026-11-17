import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildDesktopEntry, buildExec } from './desktop-entry'
import { createLogger } from './logger'

const log = createLogger('desktop-integration')

export const ICON_SIZES = [32, 48, 64, 128, 256, 512] as const

export interface DesktopIntegrationOptions {
  dataHome: string
  desktopId: string
  launchCommand: string[]
  iconSourceDir: string
}

export class DesktopIntegration {
  constructor(private readonly options: DesktopIntegrationOptions) {}

  get entryPath(): string {
    return join(this.options.dataHome, 'applications', `${this.options.desktopId}.desktop`)
  }

  private iconPath(size: number): string {
    return join(this.options.dataHome, 'icons', 'hicolor', `${size}x${size}`, 'apps', `${this.options.desktopId}.png`)
  }

  install(): string[] {
    const written: string[] = []
    for (const size of ICON_SIZES) {
      const source = join(this.options.iconSourceDir, `${size}x${size}.png`)
      if (!existsSync(source)) {
        log.warn(`missing icon ${source}`)
        continue
      }
      const target = this.iconPath(size)
      mkdirSync(join(target, '..'), { recursive: true })
      copyFileSync(source, target)
      written.push(target)
    }

    const content = buildDesktopEntry({
      Type: 'Application',
      Name: 'wa-gnome',
      GenericName: 'WhatsApp',
      Comment: 'WhatsApp Web com bandeja e notificações em segundo plano',
      Exec: buildExec(this.options.launchCommand),
      Icon: this.options.desktopId,
      Terminal: false,
      Categories: 'Network;InstantMessaging;Chat;',
      Keywords: 'WhatsApp;chat;mensagens;messenger;',
      StartupNotify: true,
      StartupWMClass: this.options.desktopId,
      SingleMainWindow: true
    })
    mkdirSync(join(this.entryPath, '..'), { recursive: true })
    writeFileSync(`${this.entryPath}.tmp`, content, { mode: 0o644 })
    renameSync(`${this.entryPath}.tmp`, this.entryPath)
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
}
