const RESERVED = /[\s"'\\><~|&;$*?#()`]/

export function quoteExecArg(arg: string): string {
  let quoted = arg
  if (arg === '' || RESERVED.test(arg)) {
    quoted = `"${arg.replace(/(["`$\\])/g, '\\$1')}"`
  }
  return quoted.replace(/\\/g, '\\\\').replace(/%/g, '%%')
}

export function buildExec(command: readonly string[]): string {
  return command.map(quoteExecArg).join(' ')
}

function escapeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')
}

export type DesktopEntryFields = Record<string, string | boolean>

export function buildDesktopEntry(fields: DesktopEntryFields): string {
  const lines = ['[Desktop Entry]']
  for (const [key, value] of Object.entries(fields)) {
    lines.push(`${key}=${typeof value === 'boolean' ? String(value) : escapeValue(value)}`)
  }
  return lines.join('\n') + '\n'
}

export function parseDesktopEntry(content: string): Map<string, string> {
  const values = new Map<string, string>()
  let inMainGroup = false
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    if (line.startsWith('[')) {
      inMainGroup = line === '[Desktop Entry]'
      continue
    }
    if (!inMainGroup) continue
    const eq = line.indexOf('=')
    if (eq > 0) values.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim())
  }
  return values
}

export function isAutostartEntryEnabled(content: string): boolean {
  const entry = parseDesktopEntry(content)
  return entry.get('Hidden') !== 'true' && entry.get('X-GNOME-Autostart-enabled') !== 'false'
}
