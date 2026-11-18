import { shell, type WebContents } from 'electron'
import { createLogger } from './logger'
import { isSafeExternalUrl, isWhatsAppUrl } from './policy'

const log = createLogger('navigation')

export function openExternalSafely(url: string): void {
  if (!isSafeExternalUrl(url)) {
    log.warn(`refused to open external URL with unsafe scheme: ${url}`)
    return
  }
  shell.openExternal(url).catch((error: unknown) => log.error(`failed to open ${url}`, error))
}

export function installNavigationPolicy(
  wc: WebContents,
  openExternal: (url: string) => void = openExternalSafely
): void {
  wc.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })

  wc.on('will-navigate', (event, url) => {
    if (isWhatsAppUrl(url)) return
    event.preventDefault()
    openExternal(url)
  })

  wc.on('will-redirect', (event, url) => {
    if (isWhatsAppUrl(url)) return
    log.warn(`blocked redirect to ${url}`)
    event.preventDefault()
  })

  wc.on('will-attach-webview', (event) => event.preventDefault())
}
