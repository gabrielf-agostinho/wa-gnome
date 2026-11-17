import { describe, expect, it } from 'vitest'
import { buildDesktopEntry, buildExec, isAutostartEntryEnabled, parseDesktopEntry, quoteExecArg } from './desktop-entry'

describe('quoteExecArg', () => {
  it('leaves simple arguments alone', () => {
    expect(quoteExecArg('/usr/bin/wa-gnome')).toBe('/usr/bin/wa-gnome')
    expect(quoteExecArg('--hidden')).toBe('--hidden')
  })

  it('quotes reserved characters', () => {
    expect(quoteExecArg('/home/a b/app')).toBe('"/home/a b/app"')
    expect(quoteExecArg('')).toBe('""')
    expect(quoteExecArg("it's")).toBe(`"it's"`)
  })

  it('escapes inside quotes and again for the string value', () => {
    // literal: a"b  → quoted "a\"b" → string-escaped "a\\"b"
    expect(quoteExecArg('a"b')).toBe('"a\\\\"b"')
    // literal: $HOME → "\$HOME" → "\\$HOME"
    expect(quoteExecArg('$HOME')).toBe('"\\\\$HOME"')
    // literal backslash: a\b → "a\\b" → "a\\\\b"
    expect(quoteExecArg('a\\b')).toBe('"a\\\\\\\\b"')
  })

  it('escapes % so it is not read as a field code', () => {
    expect(quoteExecArg('/opt/100%/app')).toBe('/opt/100%%/app')
  })
})

describe('buildExec', () => {
  it('joins quoted arguments', () => {
    expect(buildExec(['/opt/My Apps/electron', '/src/wa-gnome', '--hidden'])).toBe(
      '"/opt/My Apps/electron" /src/wa-gnome --hidden'
    )
  })
})

describe('buildDesktopEntry / parseDesktopEntry', () => {
  it('round-trips fields', () => {
    const text = buildDesktopEntry({ Type: 'Application', Name: 'wa-gnome', Terminal: false })
    expect(text).toBe('[Desktop Entry]\nType=Application\nName=wa-gnome\nTerminal=false\n')
    const parsed = parseDesktopEntry(text)
    expect(parsed.get('Name')).toBe('wa-gnome')
    expect(parsed.get('Terminal')).toBe('false')
  })

  it('escapes newlines in values', () => {
    expect(buildDesktopEntry({ Comment: 'a\nb' })).toContain('Comment=a\\nb')
  })

  it('only reads the [Desktop Entry] group and skips comments', () => {
    const parsed = parseDesktopEntry('# c\n[Desktop Entry]\nName=x\n[Desktop Action y]\nName=z\n')
    expect(parsed.get('Name')).toBe('x')
  })
})

describe('isAutostartEntryEnabled', () => {
  it('is enabled by default', () => {
    expect(isAutostartEntryEnabled('[Desktop Entry]\nExec=x\n')).toBe(true)
    expect(isAutostartEntryEnabled('[Desktop Entry]\nX-GNOME-Autostart-enabled=true\n')).toBe(true)
  })

  it('respects GNOME and spec switches', () => {
    expect(isAutostartEntryEnabled('[Desktop Entry]\nHidden=true\n')).toBe(false)
    expect(isAutostartEntryEnabled('[Desktop Entry]\nX-GNOME-Autostart-enabled=false\n')).toBe(false)
  })
})
