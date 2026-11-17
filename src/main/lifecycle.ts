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

export function acquireSingleInstance(onSecondInstance: (argv: string[]) => void): boolean {
  if (!app.requestSingleInstanceLock()) {
    log.info('another instance is running; handing over and exiting')
    return false
  }
  app.on('second-instance', (_event, argv) => {
    log.info('second instance launched; focusing existing window')
    onSecondInstance(argv)
  })
  return true
}

export function installShutdownHooks(getSession: () => Session | null): void {
  app.on('before-quit', () => {
    quitting = true
    const ses = getSession()
    if (ses) {
      ses.flushStorageData()
      ses.cookies.flushStore().catch((error: unknown) => log.warn('cookie flush failed', error))
    }
    log.info('quitting')
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
