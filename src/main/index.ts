import { join } from 'node:path'
import { app, Menu, Notification, type Session } from 'electron'
import { DESKTOP_ID } from '../shared/constants'
import { AutostartManager } from './autostart'
import { configureBackgroundExecution, configureDesktopIdentity } from './background'
import { HIDDEN_FLAG, parseCliFlags } from './cli'
import { DesktopIntegration } from './desktop-integration'
import { resolveLaunchCommand } from './launch'
import { acquireSingleInstance, installCrashLogging, installShutdownHooks, quit } from './lifecycle'
import { createLogger } from './logger'
import { NotificationManager } from './notifications'
import { SettingsStore } from './settings'
import { createWhatsAppSession } from './session'
import { TrayManager } from './tray'
import { detectTrayHost, type TrayHostStatus } from './tray-support'
import { stripAppToken } from './user-agent'
import { WindowManager } from './window'
import { xdgConfigHome, xdgDataHome } from './xdg'

const log = createLogger('main')

let windows: WindowManager | null = null
let tray: TrayManager | null = null
let notifications: NotificationManager | null = null
let whatsappSession: Session | null = null
let trayHost: TrayHostStatus = 'unknown'
let hiddenHintShown = false
let settings: SettingsStore | null = null
let autostart: AutostartManager | null = null

const flags = parseCliFlags(process.argv)

installCrashLogging()
configureDesktopIdentity()
configureBackgroundExecution()

function resource(...parts: string[]): string {
  return join(__dirname, '..', '..', 'resources', ...parts)
}

function notifyUser(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body, icon: resource('icons', '128x128.png') }).show()
}

function setAutostartEnabled(enabled: boolean): void {
  try {
    autostart?.setEnabled(enabled)
  } catch (error) {
    log.error('could not change autostart', error)
    notifyUser('Não foi possível alterar a inicialização automática', String(error))
  }
}

function desktopIntegration(): DesktopIntegration {
  return new DesktopIntegration({
    dataHome: xdgDataHome(),
    desktopId: DESKTOP_ID,
    launchCommand: resolveLaunchCommand(),
    iconSourceDir: resource('icons')
  })
}

function onHiddenByClose(): void {
  if (trayHost === 'available' || hiddenHintShown) return
  hiddenHintShown = true
  notifyUser(
    'WhatsApp continua em execução',
    'A bandeja do sistema não está disponível (ative a extensão "Ubuntu AppIndicators"). ' +
      'Para reabrir, inicie o wa-gnome novamente.'
  )
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

  settings = new SettingsStore(join(app.getPath('userData'), 'settings.json'))
  autostart = new AutostartManager({
    autostartDir: join(xdgConfigHome(), 'autostart'),
    desktopId: DESKTOP_ID,
    launchCommand: resolveLaunchCommand,
    loginArgs: () => (settings?.get('startHiddenOnLogin') ? [HIDDEN_FLAG] : [])
  })
  try {
    autostart.refresh()
  } catch (error) {
    log.warn('could not refresh autostart entry', error)
  }

  whatsappSession = createWhatsAppSession()
  windows = new WindowManager({
    session: whatsappSession,
    preloadPath: join(__dirname, '../preload/index.js'),
    iconPath: resource('icons', '256x256.png'),
    startHidden: flags.hidden,
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
      isWindowVisible: () => windows?.isVisible() ?? false,
      isAutostartEnabled: () => autostart?.isEnabled() ?? false,
      setAutostartEnabled
    },
    { normal: resource('icons', 'tray.png'), unread: resource('icons', 'tray-unread.png') }
  )
  tray.create()
  autostart.watch(() => tray?.refresh())
}

if (flags.installDesktopEntry || flags.uninstallDesktopEntry) {
  app
    .whenReady()
    .then(() => {
      const di = desktopIntegration()
      const files = flags.installDesktopEntry ? di.install() : di.uninstall()
      for (const file of files) console.log(`${flags.installDesktopEntry ? 'installed' : 'removed'} ${file}`)
      app.exit(0)
    })
    .catch((error: unknown) => {
      log.error('desktop entry operation failed', error)
      app.exit(1)
    })
} else if (!acquireSingleInstance((argv) => (parseCliFlags(argv).hidden ? undefined : windows?.show()))) {
  app.quit()
} else {
  installShutdownHooks(() => whatsappSession)

  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', () => {
    notifications?.stop()
    autostart?.unwatch()
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
