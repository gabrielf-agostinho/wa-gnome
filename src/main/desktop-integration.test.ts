import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDesktopEntry } from './desktop-entry'
import { DesktopIntegration, ICON_SIZES } from './desktop-integration'

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'wa-gnome-di-'))
  const icons = join(root, 'icons')
  mkdirSync(icons)
  for (const s of ICON_SIZES) writeFileSync(join(icons, `${s}x${s}.png`), `png${s}`)
  const di = new DesktopIntegration({
    dataHome: join(root, 'share'),
    desktopId: 'io.example.App',
    launchCommand: ['/usr/bin/electron', '/src/app'],
    iconSourceDir: icons
  })
  return { root, di }
}

describe('DesktopIntegration', () => {
  it('installs the launcher entry and hicolor icons', () => {
    const { root, di } = setup()
    const written = di.install()
    expect(written).toHaveLength(ICON_SIZES.length + 1)
    const entry = parseDesktopEntry(readFileSync(di.entryPath, 'utf8'))
    expect(entry.get('Exec')).toBe('/usr/bin/electron /src/app')
    expect(entry.get('Icon')).toBe('io.example.App')
    expect(entry.get('StartupWMClass')).toBe('io.example.App')
    expect(readFileSync(join(root, 'share/icons/hicolor/128x128/apps/io.example.App.png'), 'utf8')).toBe('png128')
  })

  it('uninstalls everything it installed', () => {
    const { di } = setup()
    di.install()
    expect(di.uninstall()).toHaveLength(ICON_SIZES.length + 1)
    expect(existsSync(di.entryPath)).toBe(false)
    expect(di.uninstall()).toHaveLength(0)
  })
})
