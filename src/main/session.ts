import { session, type Session } from 'electron'
import { SESSION_PARTITION } from '../shared/constants'
import { createLogger } from './logger'
import { isPermissionAllowed } from './policy'

const log = createLogger('session')

export function createWhatsAppSession(): Session {
  const ses = session.fromPartition(SESSION_PARTITION)

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const allowed = isPermissionAllowed(permission, details.requestingUrl || wc.getURL())
    log.debug(`permission request ${permission} from ${details.requestingUrl}: ${allowed}`)
    callback(allowed)
  })

  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    return isPermissionAllowed(permission, requestingOrigin)
  })

  log.info(`using persistent partition "${SESSION_PARTITION}" at ${ses.storagePath ?? '(in-memory!)'}`)
  if (ses.storagePath === null) {
    log.error('session is not persistent; login will not survive restarts')
  }
  return ses
}
