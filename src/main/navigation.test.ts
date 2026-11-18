import { EventEmitter } from 'node:events'
import type { WebContents } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const openExternal = vi.fn(() => Promise.resolve())
vi.mock('electron', () => ({ shell: { openExternal } }))

const { installNavigationPolicy, openExternalSafely } = await import('./navigation')

class FakeWebContents extends EventEmitter {
  windowOpenHandler: ((details: { url: string }) => { action: string }) | null = null
  setWindowOpenHandler(handler: (details: { url: string }) => { action: string }): void {
    this.windowOpenHandler = handler
  }
}

function setup() {
  const wc = new FakeWebContents()
  const open = vi.fn()
  installNavigationPolicy(wc as unknown as WebContents, open)
  const fire = (name: string, url?: string) => {
    const event = { preventDefault: vi.fn() }
    wc.emit(name, event, url)
    return event
  }
  return { wc, open, fire }
}

describe('installNavigationPolicy', () => {
  it('denies new windows and opens them externally', () => {
    const { wc, open } = setup()
    expect(wc.windowOpenHandler?.({ url: 'https://example.com/' })).toEqual({ action: 'deny' })
    expect(open).toHaveBeenCalledWith('https://example.com/')
  })

  it('keeps WhatsApp navigation in the window and sends the rest outside', () => {
    const { open, fire } = setup()
    expect(fire('will-navigate', 'https://web.whatsapp.com/x').preventDefault).not.toHaveBeenCalled()
    expect(fire('will-navigate', 'https://example.com/').preventDefault).toHaveBeenCalled()
    expect(open).toHaveBeenCalledExactlyOnceWith('https://example.com/')
  })

  it('blocks foreign redirects and webviews without opening anything', () => {
    const { open, fire } = setup()
    expect(fire('will-redirect', 'https://web.whatsapp.com/').preventDefault).not.toHaveBeenCalled()
    expect(fire('will-redirect', 'https://evil.example/').preventDefault).toHaveBeenCalled()
    expect(fire('will-attach-webview').preventDefault).toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})

describe('openExternalSafely', () => {
  beforeEach(() => openExternal.mockClear())

  it('opens only safe schemes', () => {
    openExternalSafely('https://example.com/')
    openExternalSafely('file:///etc/passwd')
    openExternalSafely('javascript:alert(1)')
    expect(openExternal).toHaveBeenCalledExactlyOnceWith('https://example.com/')
  })
})
