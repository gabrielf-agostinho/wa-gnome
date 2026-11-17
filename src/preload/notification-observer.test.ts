import { afterEach, describe, expect, it, vi } from 'vitest'
import { installNotificationObserver } from './notification-observer'

class FakeNotification extends EventTarget {
  static permission = 'granted'
  static requestPermission = vi.fn(async () => 'granted')
  constructor(
    readonly title: string,
    readonly options?: NotificationOptions
  ) {
    super()
  }
}

const g = globalThis as unknown as { Notification?: unknown }

afterEach(() => {
  delete g.Notification
})

describe('installNotificationObserver', () => {
  it('keeps the native behaviour and static API', () => {
    g.Notification = FakeNotification
    installNotificationObserver(() => {}, () => {})
    const N = g.Notification as typeof FakeNotification
    expect(N).not.toBe(FakeNotification)
    expect(N.name).toBe('Notification')
    expect(N.permission).toBe('granted')
    void N.requestPermission()
    expect(FakeNotification.requestPermission).toHaveBeenCalled()
    const n = new N('title', { body: 'b', tag: 't' })
    expect(n).toBeInstanceOf(FakeNotification)
    expect(n.title).toBe('title')
    expect(n.options?.tag).toBe('t')
  })

  it('reports show and click without passing any content', () => {
    g.Notification = FakeNotification
    const shown = vi.fn()
    const clicked = vi.fn()
    installNotificationObserver(shown, clicked)
    const N = g.Notification as typeof FakeNotification
    const n = new N('secret message')
    n.dispatchEvent(new Event('show'))
    n.dispatchEvent(new Event('click'))
    expect(shown).toHaveBeenCalledWith()
    expect(clicked).toHaveBeenCalledWith()
  })

  it('still runs the page own onclick-style listeners', () => {
    g.Notification = FakeNotification
    installNotificationObserver(() => {}, () => {})
    const N = g.Notification as typeof FakeNotification
    const pageHandler = vi.fn()
    const n = new N('x')
    n.addEventListener('click', pageHandler)
    n.dispatchEvent(new Event('click'))
    expect(pageHandler).toHaveBeenCalledOnce()
  })

  it('is idempotent and tolerates a missing Notification API', () => {
    expect(() => installNotificationObserver(() => {}, () => {})).not.toThrow()
    g.Notification = FakeNotification
    installNotificationObserver(() => {}, () => {})
    const once = g.Notification
    installNotificationObserver(() => {}, () => {})
    expect(g.Notification).toBe(once)
  })
})
