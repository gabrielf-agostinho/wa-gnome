import { app } from 'electron'
import { DESKTOP_ID } from '../shared/constants'

export function configureBackgroundExecution(): void {
  app.commandLine.appendSwitch('disable-background-timer-throttling')
  app.commandLine.appendSwitch('disable-features', 'IntensiveWakeUpThrottling')
}

export function configureDesktopIdentity(): void {
  app.setDesktopName(`${DESKTOP_ID}.desktop`)
}
