import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { AutostartManager } from './autostart'
import { parseDesktopEntry } from './desktop-entry'

function setup(command = ['/opt/wa gnome/wa-gnome'], loginArgs = ['--hidden']) {
  const dir = join(mkdtempSync(join(tmpdir(), 'wa-gnome-autostart-')), 'autostart')
  const state = { command, loginArgs }
  const manager = new AutostartManager({
    autostartDir: dir,
    desktopId: 'io.example.App',
    iconName: 'example-app',
    launchCommand: () => state.command,
    loginArgs: () => state.loginArgs
  })
  return { dir, manager, state }
}

describe('AutostartManager', () => {
  it('is disabled when no file exists', () => {
    expect(setup().manager.isEnabled()).toBe(false)
  })

  it('creates the directory and a valid entry when enabled', () => {
    const { manager, dir } = setup()
    manager.setEnabled(true)
    expect(manager.isEnabled()).toBe(true)
    const entry = parseDesktopEntry(readFileSync(join(dir, 'io.example.App.desktop'), 'utf8'))
    expect(entry.get('Type')).toBe('Application')
    expect(entry.get('Exec')).toBe('"/opt/wa gnome/wa-gnome" --hidden')
    expect(entry.get('X-GNOME-Autostart-enabled')).toBe('true')
    expect(existsSync(join(dir, 'io.example.App.desktop.tmp'))).toBe(false)
  })

  it('removes the file when disabled, and disabling twice is fine', () => {
    const { manager } = setup()
    manager.setEnabled(true)
    manager.setEnabled(false)
    manager.setEnabled(false)
    expect(existsSync(manager.filePath)).toBe(false)
    expect(manager.isEnabled()).toBe(false)
  })

  it('reports disabled when GNOME Tweaks turned the entry off', () => {
    const { manager } = setup()
    manager.setEnabled(true)
    writeFileSync(manager.filePath, readFileSync(manager.filePath, 'utf8').replace('X-GNOME-Autostart-enabled=true', 'X-GNOME-Autostart-enabled=false'))
    expect(manager.isEnabled()).toBe(false)
  })

  it('refresh rewrites a stale Exec only when enabled', () => {
    const { manager, state } = setup()
    manager.refresh()
    expect(existsSync(manager.filePath)).toBe(false)

    manager.setEnabled(true)
    state.command = ['/new/path/wa-gnome.AppImage']
    state.loginArgs = []
    manager.refresh()
    expect(parseDesktopEntry(readFileSync(manager.filePath, 'utf8')).get('Exec')).toBe('/new/path/wa-gnome.AppImage')
  })
  it('notifies when the entry changes on disk, even if the dir is created later', async () => {
    const { manager } = setup()
    const onChange = vi.fn()
    manager.watch(onChange)
    manager.setEnabled(true)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 2000 })
    onChange.mockClear()
    writeFileSync(manager.filePath, readFileSync(manager.filePath, 'utf8').replace('X-GNOME-Autostart-enabled=true', 'X-GNOME-Autostart-enabled=false'))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 2000 })
    manager.unwatch()
  })
})
