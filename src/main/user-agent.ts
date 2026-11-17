export function stripAppToken(userAgent: string, appName: string, appVersion: string): string {
  const token = ` ${appName}/${appVersion}`
  return userAgent.includes(token) ? userAgent.replace(token, '') : userAgent
}
