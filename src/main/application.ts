import { join } from 'node:path'
import { app, Menu, type Session } from 'electron'
import { DESKTOP_ID, ICON_NAME } from '../shared/constants'
import { STRINGS } from '../shared/strings'
import { AutostartManager } from './autostart'
import { HIDDEN_FLAG, parseCliFlags } from './cli'
import { resolveLaunchCommand } from './launch'
import { flushSessionOnQuit, isQuitting, onSecondInstance, quit } from './lifecycle'
import { createLogger } from './logger'
import { NotificationManager } from './notifications'
import { preloadPath, resourcePath } from './paths'
import { createWhatsAppSession } from './session'
import { SettingsStore } from './settings'
import { TrayManager, type AutostartToggle } from './tray'
import { detectTrayHost, type TrayHostStatus } from './tray-support'
import { stripAppToken } from './user-agent'
import { notifyUser } from './user-notification'
import { WindowManager } from './window'
import { xdgConfigHome } from './xdg'

const log = createLogger('main')

export interface ApplicationOptions {
  startHidden: boolean
}

export class Application {
  private readonly settings: SettingsStore
  private readonly autostart: AutostartManager
  private readonly session: Session
  private readonly windows: WindowManager
  private readonly notifications: NotificationManager
  private readonly tray: TrayManager
  private trayHost: TrayHostStatus = 'unknown'
  private hiddenHintShown = false

  constructor(options: ApplicationOptions) {
    this.settings = new SettingsStore(join(app.getPath('userData'), 'settings.json'))
    this.autostart = new AutostartManager({
      autostartDir: join(xdgConfigHome(), 'autostart'),
      desktopId: DESKTOP_ID,
      iconName: ICON_NAME,
      launchCommand: resolveLaunchCommand,
      loginArgs: () => (this.settings.get('startHiddenOnLogin') ? [HIDDEN_FLAG] : [])
    })
    this.session = createWhatsAppSession()
    this.windows = new WindowManager({
      session: this.session,
      preloadPath: preloadPath(),
      iconPath: resourcePath('icons', '256x256.png'),
      startHidden: options.startHidden,
      isQuitting,
      onVisibilityChanged: () => this.tray.refresh(),
      onUnreadChanged: (count) => this.tray.setUnread(count),
      onHiddenByClose: () => this.showHiddenHint(),
      onQuitRequested: quit
    })
    this.notifications = new NotificationManager({
      getWebContents: () => this.windows.webContents,
      activate: () => this.windows.show()
    })
    this.tray = new TrayManager(
      { window: this.windows, autostart: this.autostartToggle(), quit },
      { normal: resourcePath('icons', 'tray.png'), unread: resourcePath('icons', 'tray-unread.png') }
    )
  }

  async start(): Promise<void> {
    this.logEnvironment()
    this.configureApp()
    this.refreshAutostart()

    flushSessionOnQuit(this.session)
    onSecondInstance((argv) => {
      if (!parseCliFlags(argv).hidden) this.windows.show()
    })
    app.on('will-quit', () => this.stop())

    this.notifications.start()
    this.windows.create()

    this.trayHost = await detectTrayHost()
    if (this.trayHost === 'missing') {
      log.warn(
        'no StatusNotifierItem host on D-Bus: the tray icon will not be visible. ' +
          'Enable the "Ubuntu AppIndicators" GNOME extension.'
      )
    }

    this.tray.create()
    this.autostart.watch(() => this.tray.refresh())
  }

  private stop(): void {
    this.notifications.stop()
    this.autostart.unwatch()
    this.tray.destroy()
  }

  private logEnvironment(): void {
    log.info(
      `starting wa-gnome ${app.getVersion()} (electron ${process.versions.electron}, ` +
        `chrome ${process.versions.chrome}, ozone ${app.commandLine.getSwitchValue('ozone-platform') || 'auto'}, ` +
        `session ${process.env['XDG_SESSION_TYPE'] ?? 'unknown'})`
    )
  }

  private configureApp(): void {
    if (process.env['WA_GNOME_DEBUG'] !== '1') Menu.setApplicationMenu(null)
    app.userAgentFallback = stripAppToken(app.userAgentFallback, app.getName(), app.getVersion())
    log.info(`user agent: ${app.userAgentFallback}`)
  }

  private refreshAutostart(): void {
    try {
      this.autostart.refresh()
    } catch (error) {
      log.warn('could not refresh autostart entry', error)
    }
  }

  private autostartToggle(): AutostartToggle {
    return {
      isEnabled: () => this.autostart.isEnabled(),
      setEnabled: (enabled) => {
        try {
          this.autostart.setEnabled(enabled)
        } catch (error) {
          log.error('could not change autostart', error)
          notifyUser(STRINGS.notifications.autostartFailed, String(error))
        }
      }
    }
  }

  private showHiddenHint(): void {
    if (this.trayHost === 'available' || this.hiddenHintShown) return
    this.hiddenHintShown = true
    notifyUser(STRINGS.notifications.hiddenWithoutTrayTitle, STRINGS.notifications.hiddenWithoutTrayBody)
  }
}
