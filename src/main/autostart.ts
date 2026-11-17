import { mkdirSync, readFileSync, renameSync, rmSync, watch, writeFileSync, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import { buildDesktopEntry, buildExec, isAutostartEntryEnabled, parseDesktopEntry } from './desktop-entry'
import { createLogger } from './logger'

const log = createLogger('autostart')

export interface AutostartOptions {
  autostartDir: string
  desktopId: string
  iconName: string
  launchCommand: () => string[]
  loginArgs: () => string[]
}

export class AutostartManager {
  private watcher: FSWatcher | null = null
  private onChange: (() => void) | null = null
  private debounce: NodeJS.Timeout | null = null

  constructor(private readonly options: AutostartOptions) {}

  watch(onChange: () => void): void {
    this.onChange = onChange
    this.startWatching()
  }

  unwatch(): void {
    this.watcher?.close()
    this.watcher = null
    this.onChange = null
    if (this.debounce) clearTimeout(this.debounce)
  }

  private startWatching(): void {
    if (this.watcher || !this.onChange) return
    const fileName = `${this.options.desktopId}.desktop`
    try {
      this.watcher = watch(this.options.autostartDir, (_event, name) => {
        if (name !== fileName) return
        if (this.debounce) clearTimeout(this.debounce)
        this.debounce = setTimeout(() => this.onChange?.(), 150)
      })
      this.watcher.on('error', () => {
        this.watcher?.close()
        this.watcher = null
      })
    } catch {
    }
  }

  get filePath(): string {
    return join(this.options.autostartDir, `${this.options.desktopId}.desktop`)
  }

  isEnabled(): boolean {
    const content = this.readEntry()
    return content !== null && isAutostartEntryEnabled(content)
  }

  setEnabled(enabled: boolean): void {
    if (enabled) this.write()
    else this.remove()
  }

  refresh(): void {
    const content = this.readEntry()
    if (content === null || !isAutostartEntryEnabled(content)) return
    if (parseDesktopEntry(content).get('Exec') !== this.exec()) {
      log.info('autostart entry is stale; rewriting Exec')
      this.write()
    }
  }

  private exec(): string {
    return buildExec([...this.options.launchCommand(), ...this.options.loginArgs()])
  }

  private write(): void {
    const content = buildDesktopEntry({
      Type: 'Application',
      Name: 'wa-gnome',
      GenericName: 'WhatsApp',
      Comment: 'Mantém o WhatsApp Web em segundo plano para receber notificações',
      Exec: this.exec(),
      Icon: this.options.iconName,
      Terminal: false,
      NoDisplay: false,
      StartupNotify: false,
      'X-GNOME-Autostart-enabled': true,
      'X-GNOME-Autostart-Delay': '3'
    })
    mkdirSync(this.options.autostartDir, { recursive: true })
    this.startWatching()
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, content, { mode: 0o644 })
    renameSync(tmp, this.filePath)
    log.info(`autostart enabled: ${this.filePath}`)
  }

  private remove(): void {
    rmSync(this.filePath, { force: true })
    log.info('autostart disabled')
  }

  private readEntry(): string | null {
    try {
      return readFileSync(this.filePath, 'utf8')
    } catch {
      return null
    }
  }
}
