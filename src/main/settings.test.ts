import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SettingsStore, sanitizeSettings } from './settings'

const tempFile = (): string => join(mkdtempSync(join(tmpdir(), 'wa-gnome-settings-')), 'settings.json')

describe('sanitizeSettings', () => {
  it('drops unknown keys and wrong types', () => {
    expect(sanitizeSettings({ startHiddenOnLogin: 'yes', other: 1 })).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings({ startHiddenOnLogin: false })).toEqual({ startHiddenOnLogin: false })
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings([1, 2])).toEqual(DEFAULT_SETTINGS)
  })
})

describe('SettingsStore', () => {
  it('uses defaults when the file is missing and does not create it on read', () => {
    const file = tempFile()
    const store = new SettingsStore(file)
    expect(store.get('startHiddenOnLogin')).toBe(DEFAULT_SETTINGS.startHiddenOnLogin)
    expect(existsSync(file)).toBe(false)
  })

  it('persists changes across instances', () => {
    const file = tempFile()
    new SettingsStore(file).set('startHiddenOnLogin', false)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ startHiddenOnLogin: false })
    expect(new SettingsStore(file).get('startHiddenOnLogin')).toBe(false)
    expect(existsSync(`${file}.tmp`)).toBe(false)
  })

  it('moves a corrupt file aside and falls back to defaults', () => {
    const file = tempFile()
    writeFileSync(file, '{ not json')
    const store = new SettingsStore(file)
    expect(store.get('startHiddenOnLogin')).toBe(DEFAULT_SETTINGS.startHiddenOnLogin)
    expect(readFileSync(`${file}.corrupt`, 'utf8')).toBe('{ not json')
  })
})
