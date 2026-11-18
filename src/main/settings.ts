import { readFileSync, renameSync } from 'node:fs'
import { writeFileAtomic } from './fs-utils'
import { createLogger } from './logger'

const log = createLogger('settings')

export interface Settings {
  startHiddenOnLogin: boolean
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  startHiddenOnLogin: true
})

export function sanitizeSettings(raw: unknown): Settings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const result: Settings = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (typeof source[key] === typeof DEFAULT_SETTINGS[key]) {
      ;(result as unknown as Record<string, unknown>)[key] = source[key]
    }
  }
  return result
}

export class SettingsStore {
  private current: Settings

  constructor(private readonly filePath: string) {
    this.current = this.read()
  }

  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.current[key]
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    if (this.current[key] === value) return
    this.current = { ...this.current, [key]: value }
    this.write()
  }

  private read(): Settings {
    let text: string
    try {
      text = readFileSync(this.filePath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') log.warn(`cannot read ${this.filePath}`, error)
      return { ...DEFAULT_SETTINGS }
    }
    try {
      return sanitizeSettings(JSON.parse(text))
    } catch {
      log.warn(`corrupt settings file; moved to ${this.filePath}.corrupt and using defaults`)
      try {
        renameSync(this.filePath, `${this.filePath}.corrupt`)
      } catch (error) {
        log.debug('could not move corrupt settings file aside', error)
      }
      return { ...DEFAULT_SETTINGS }
    }
  }

  private write(): void {
    writeFileAtomic(this.filePath, JSON.stringify(this.current, null, 2) + '\n', 0o600)
  }
}
