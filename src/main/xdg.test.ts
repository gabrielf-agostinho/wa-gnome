import { describe, expect, it } from 'vitest'
import { xdgConfigHome, xdgDataHome, xdgStateHome } from './xdg'

describe('xdg dirs', () => {
  it('uses the environment when absolute', () => {
    expect(xdgConfigHome({ XDG_CONFIG_HOME: '/x/cfg', HOME: '/h' })).toBe('/x/cfg')
    expect(xdgDataHome({ XDG_DATA_HOME: '/x/data', HOME: '/h' })).toBe('/x/data')
  })

  it('falls back to HOME, ignoring relative values', () => {
    expect(xdgConfigHome({ HOME: '/h' })).toBe('/h/.config')
    expect(xdgConfigHome({ XDG_CONFIG_HOME: 'rel', HOME: '/h' })).toBe('/h/.config')
    expect(xdgDataHome({ HOME: '/h' })).toBe('/h/.local/share')
    expect(xdgStateHome({ HOME: '/h' })).toBe('/h/.local/state')
    expect(xdgStateHome({ XDG_STATE_HOME: '/x/state', HOME: '/h' })).toBe('/x/state')
  })
})
