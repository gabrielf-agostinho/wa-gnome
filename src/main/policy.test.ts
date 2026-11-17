import { describe, expect, it } from 'vitest'
import { isPermissionAllowed, isSafeExternalUrl, isWhatsAppUrl } from './policy'

describe('isWhatsAppUrl', () => {
  it('accepts the WhatsApp Web origin', () => {
    expect(isWhatsAppUrl('https://web.whatsapp.com/')).toBe(true)
    expect(isWhatsAppUrl('https://web.whatsapp.com/send?phone=1')).toBe(true)
  })

  it('rejects other hosts, schemes and look-alikes', () => {
    expect(isWhatsAppUrl('http://web.whatsapp.com/')).toBe(false)
    expect(isWhatsAppUrl('https://www.whatsapp.com/')).toBe(false)
    expect(isWhatsAppUrl('https://web.whatsapp.com.evil.example/')).toBe(false)
    expect(isWhatsAppUrl('https://evil.example/?u=https://web.whatsapp.com')).toBe(false)
    expect(isWhatsAppUrl('https://web.whatsapp.com:8443/')).toBe(false)
    expect(isWhatsAppUrl('not a url')).toBe(false)
  })
})

describe('isSafeExternalUrl', () => {
  it('allows web, mail and phone links', () => {
    expect(isSafeExternalUrl('https://example.com/a')).toBe(true)
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
    expect(isSafeExternalUrl('mailto:a@example.com')).toBe(true)
    expect(isSafeExternalUrl('tel:+5511999999999')).toBe(true)
  })

  it('blocks local and scriptable schemes', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('blob:https://web.whatsapp.com/123')).toBe(false)
    expect(isSafeExternalUrl('smb://host/share')).toBe(false)
    expect(isSafeExternalUrl('')).toBe(false)
  })
})

describe('isPermissionAllowed', () => {
  it('grants needed permissions to WhatsApp only', () => {
    expect(isPermissionAllowed('notifications', 'https://web.whatsapp.com/')).toBe(true)
    expect(isPermissionAllowed('media', 'https://web.whatsapp.com/')).toBe(true)
    expect(isPermissionAllowed('notifications', 'https://evil.example/')).toBe(false)
  })

  it('denies everything else', () => {
    expect(isPermissionAllowed('geolocation', 'https://web.whatsapp.com/')).toBe(false)
    expect(isPermissionAllowed('display-capture', 'https://web.whatsapp.com/')).toBe(false)
    expect(isPermissionAllowed('openExternal', 'https://web.whatsapp.com/')).toBe(false)
  })
})
