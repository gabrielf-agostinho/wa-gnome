import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

type Env = Record<string, string | undefined>

function base(env: Env, name: string, fallback: string): string {
  const value = env[name]
  return value && isAbsolute(value) ? value : join(env['HOME'] ?? homedir(), fallback)
}

export function xdgConfigHome(env: Env = process.env): string {
  return base(env, 'XDG_CONFIG_HOME', '.config')
}

export function xdgDataHome(env: Env = process.env): string {
  return base(env, 'XDG_DATA_HOME', join('.local', 'share'))
}

export function xdgStateHome(env: Env = process.env): string {
  return base(env, 'XDG_STATE_HOME', join('.local', 'state'))
}
