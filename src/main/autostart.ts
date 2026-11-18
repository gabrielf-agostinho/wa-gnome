import { mkdirSync, readFileSync, rmSync, watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import { STRINGS } from '../shared/strings'
import {
  baseDesktopFields,
  buildDesktopEntry,
  buildExec,
  desktopFileName,
  isAutostartEntryEnabled,
  parseDesktopEntry
} from './desktop-entry'
import { writeFileAtomic } from './fs-utils'
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

  private get fileName(): string {
    return desktopFileName(this.options.desktopId)
  }

  private startWatching(): void {
    if (this.watcher || !this.onChange) return
    try {
      this.watcher = watch(this.options.autostartDir, (_event, name) => {
        if (name !== this.fileName) return
        if (this.debounce) clearTimeout(this.debounce)
        this.debounce = setTimeout(() => this.onChange?.(), 150)
      })
      this.watcher.on('error', () => {
        this.watcher?.close()
        this.watcher = null
      })
    } catch (error) {
      log.debug(`cannot watch ${this.options.autostartDir} yet`, error)
    }
  }

  get filePath(): string {
    return join(this.options.autostartDir, this.fileName)
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
      ...baseDesktopFields(this.options.iconName),
      Comment: STRINGS.desktopEntry.autostartComment,
      Exec: this.exec(),
      NoDisplay: false,
      StartupNotify: false,
      'X-GNOME-Autostart-enabled': true,
      'X-GNOME-Autostart-Delay': '3'
    })
    mkdirSync(this.options.autostartDir, { recursive: true })
    this.startWatching()
    writeFileAtomic(this.filePath, content, 0o644)
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
