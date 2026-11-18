import { app, type Session } from 'electron'
import { createLogger } from './logger'

const log = createLogger('lifecycle')

let quitting = false

export function isQuitting(): boolean {
  return quitting
}

export function quit(): void {
  quitting = true
  app.quit()
}

export function installQuitTracking(): void {
  app.on('before-quit', () => {
    quitting = true
    log.info('quitting')
  })
}

export function acquireSingleInstance(): boolean {
  if (app.requestSingleInstanceLock()) return true
  log.info('another instance is running; handing over and exiting')
  return false
}

export function onSecondInstance(handler: (argv: string[]) => void): void {
  app.on('second-instance', (_event, argv) => {
    log.info('second instance launched; focusing existing window')
    handler(argv)
  })
}

export function flushSessionOnQuit(ses: Session): void {
  app.on('before-quit', () => {
    ses.flushStorageData()
    ses.cookies.flushStore().catch((error: unknown) => log.warn('cookie flush failed', error))
  })
}

export function installCrashLogging(): void {
  process.on('uncaughtException', (error) => log.error('uncaught exception', error))
  process.on('unhandledRejection', (reason) => log.error('unhandled rejection', reason))
  app.on('child-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') return
    if (quitting) return log.info(`${details.type} process ended during shutdown: ${details.reason}`)
    log.error(`${details.type} process gone: ${details.reason} (exit ${details.exitCode})`)
  })
}
