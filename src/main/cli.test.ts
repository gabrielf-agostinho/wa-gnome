import { describe, expect, it } from 'vitest'
import { parseCliFlags } from './cli'

describe('parseCliFlags', () => {
  it('reads known flags anywhere in argv', () => {
    expect(parseCliFlags(['/usr/bin/electron', '/app', '--hidden'])).toEqual({
      hidden: true,
      installDesktopEntry: false,
      uninstallDesktopEntry: false
    })
    expect(parseCliFlags(['x', '--install-desktop-entry']).installDesktopEntry).toBe(true)
    expect(parseCliFlags(['x', '--uninstall-desktop-entry']).uninstallDesktopEntry).toBe(true)
  })

  it('defaults to false', () => {
    expect(parseCliFlags([])).toEqual({ hidden: false, installDesktopEntry: false, uninstallDesktopEntry: false })
  })
})
