import { WHATSAPP_ORIGIN } from '../shared/constants'

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function isWhatsAppUrl(url: string): boolean {
  const parsed = parse(url)
  return parsed !== null && parsed.origin === WHATSAPP_ORIGIN
}

const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:'])

export function isSafeExternalUrl(url: string): boolean {
  const parsed = parse(url)
  return parsed !== null && EXTERNAL_PROTOCOLS.has(parsed.protocol)
}

const ALLOWED_PERMISSIONS = new Set([
  'notifications',
  'media',
  'clipboard-sanitized-write',
  'fullscreen'
])

export function isPermissionAllowed(permission: string, requestingUrl: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission) && isWhatsAppUrl(requestingUrl)
}
