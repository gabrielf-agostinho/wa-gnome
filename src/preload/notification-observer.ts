export function installNotificationObserver(onShown: () => void, onClicked: () => void): void {
  const target = globalThis as unknown as { Notification?: typeof Notification }
  const Native = target.Notification
  if (typeof Native !== 'function') return
  if ((Native as unknown as { __waGnome?: boolean }).__waGnome) return

  class ObservedNotification extends Native {
    constructor(title: string, options?: NotificationOptions) {
      super(title, options)
      this.addEventListener('show', () => onShown())
      this.addEventListener('click', () => onClicked())
    }
  }

  Object.defineProperty(ObservedNotification, 'name', { value: 'Notification' })
  Object.defineProperty(ObservedNotification, '__waGnome', { value: true })
  Object.defineProperty(target, 'Notification', {
    value: ObservedNotification,
    writable: true,
    configurable: true,
    enumerable: false
  })
}
