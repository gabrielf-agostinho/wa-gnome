import { join } from 'node:path'
import { app, Menu, Notification, type Session } from 'electron'
import { configureBackgroundExecution, configureDesktopIdentity } from './background'
import { acquireSingleInstance, installCrashLogging, installShutdownHooks, quit } from './lifecycle'
import { createLogger } from './logger'
import { NotificationManager } from './notifications'
import { createWhatsAppSession } from './session'
import { TrayManager } from './tray'
import { detectTrayHost, type TrayHostStatus } from './tray-support'
import { stripAppToken } from './user-agent'
import { WindowManager } from './window'

const log = createLogger('main')

let windows: WindowManager | null = null
let tray: TrayManager | null = null
let notifications: NotificationManager | null = null
let whatsappSession: Session | null = null
let trayHost: TrayHostStatus = 'unknown'
let hiddenHintShown = false

installCrashLogging()
configureDesktopIdentity()
configureBackgroundExecution()

function resource(...parts: string[]): string {
  return join(__dirname, '..', '..', 'resources', ...parts)
}

function onHiddenByClose(): void {
  if (trayHost === 'available' || hiddenHintShown) return
  hiddenHintShown = true
  if (!Notification.isSupported()) return
  new Notification({
    title: 'WhatsApp continua em execução',
    body:
      'A bandeja do sistema não está disponível (ative a extensão "Ubuntu AppIndicators"). ' +
      'Para reabrir, inicie o wa-gnome novamente.',
    icon: resource('icons', '128x128.png')
  }).show()
}

async function start(): Promise<void> {
  log.info(
    `starting wa-gnome ${app.getVersion()} (electron ${process.versions.electron}, ` +
      `chrome ${process.versions.chrome}, ozone ${app.commandLine.getSwitchValue('ozone-platform') || 'auto'}, ` +
      `session ${process.env['XDG_SESSION_TYPE'] ?? 'unknown'})`
  )

  if (process.env['WA_GNOME_DEBUG'] !== '1') Menu.setApplicationMenu(null)

  app.userAgentFallback = stripAppToken(app.userAgentFallback, app.getName(), app.getVersion())
  log.info(`user agent: ${app.userAgentFallback}`)

  whatsappSession = createWhatsAppSession()
  windows = new WindowManager({
    session: whatsappSession,
    preloadPath: join(__dirname, '../preload/index.js'),
    iconPath: resource('icons', '256x256.png'),
    onVisibilityChanged: () => tray?.refresh(),
    onUnreadChanged: (count) => tray?.setUnread(count),
    onHiddenByClose,
    onQuitRequested: quit
  })
  notifications = new NotificationManager({
    getWebContents: () => windows?.browserWindow?.webContents ?? null,
    activate: () => windows?.show()
  })
  notifications.start()
  windows.create()

  trayHost = await detectTrayHost()
  if (trayHost === 'missing') {
    log.warn(
      'no StatusNotifierItem host on D-Bus: the tray icon will not be visible. ' +
        'Enable the "Ubuntu AppIndicators" GNOME extension.'
    )
  }
  
  tray = new TrayManager(
    {
      show: () => windows?.show(),
      hide: () => windows?.hide(),
      quit,
      isWindowVisible: () => windows?.isVisible() ?? false
    },
    { normal: resource('icons', 'tray.png'), unread: resource('icons', 'tray-unread.png') }
  )
  tray.create()
}

if (!acquireSingleInstance(() => windows?.show())) {
  app.quit()
} else {
  installShutdownHooks(() => whatsappSession)

  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', () => {
    notifications?.stop()
    tray?.destroy()
  })

  app
    .whenReady()
    .then(start)
    .catch((error: unknown) => {
      log.error('fatal startup error', error)
      app.exit(1)
    })
}
