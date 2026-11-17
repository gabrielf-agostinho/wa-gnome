import { describe, expect, it } from 'vitest'
import { stripAppToken } from './user-agent'

const base = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)'
const tail = 'Chrome/156.0.8078.100 Electron/45.3.3 Safari/537.36'

describe('stripAppToken', () => {
  it('removes the app name/version token Electron inserts', () => {
    expect(stripAppToken(`${base} wa-gnome/0.1.0 ${tail}`, 'wa-gnome', '0.1.0')).toBe(`${base} ${tail}`)
  })

  it('leaves a UA without the token unchanged', () => {
    expect(stripAppToken(`${base} ${tail}`, 'wa-gnome', '0.1.0')).toBe(`${base} ${tail}`)
  })

  it('does not touch other tokens', () => {
    const ua = `${base} wa-gnome/0.2.0 ${tail}`
    expect(stripAppToken(ua, 'wa-gnome', '0.1.0')).toBe(ua)
  })
})
