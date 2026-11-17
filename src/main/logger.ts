import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { inspect } from 'node:util'

type Level = 'debug' | 'info' | 'warn' | 'error'

const debugEnabled = process.env['WA_GNOME_DEBUG'] === '1'

export interface FileSinkOptions {
  maxBytes?: number
  keep?: number
}

interface FileSink {
  path: string
  maxBytes: number
  keep: number
  size: number
}

let fileSink: FileSink | null = null

export function formatLine(date: Date, level: Level, scope: string, message: string, extra: unknown[]): string {
  const parts = [message, ...extra.map((e) => (typeof e === 'string' ? e : inspect(e, { depth: 4, breakLength: Infinity })))]
  return `${date.toISOString()} [${level.toUpperCase()}] [${scope}] ${parts.join(' ')}`
}

/** Shifts `file` → `file.1` → … → `file.<keep>`, dropping the oldest. */
export function rotateLogFile(path: string, keep: number): void {
  rmSync(`${path}.${keep}`, { force: true })
  for (let i = keep - 1; i >= 1; i--) {
    if (existsSync(`${path}.${i}`)) renameSync(`${path}.${i}`, `${path}.${i + 1}`)
  }
  if (existsSync(path)) renameSync(path, `${path}.1`)
}

function fileSize(path: string): number {
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}

export function enableFileLogging(path: string, options: FileSinkOptions = {}): void {
  const sink: FileSink = { path, maxBytes: options.maxBytes ?? 1024 * 1024, keep: options.keep ?? 3, size: 0 }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  sink.size = fileSize(path)
  if (sink.size >= sink.maxBytes) {
    rotateLogFile(path, sink.keep)
    sink.size = 0
  }
  fileSink = sink
}

export function disableFileLogging(): void {
  fileSink = null
}

export function logFilePath(): string | null {
  return fileSink?.path ?? null
}

function writeToFile(line: string): void {
  const sink = fileSink
  if (!sink) return
  const data = `${line}\n`
  const bytes = Buffer.byteLength(data)
  try {
    if (sink.size > 0 && sink.size + bytes > sink.maxBytes) {
      rotateLogFile(sink.path, sink.keep)
      sink.size = 0
    }
    appendFileSync(sink.path, data, { mode: 0o600 })
    sink.size += bytes
  } catch (error) {
    fileSink = null
    console.error(`log file disabled: ${String(error)}`)
  }
}

function write(level: Level, scope: string, message: string, extra: unknown[]): void {
  if (level === 'debug' && !debugEnabled) return
  const line = formatLine(new Date(), level, scope, message, extra)
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  sink(line)
  writeToFile(line)
}

export interface Logger {
  debug(message: string, ...extra: unknown[]): void
  info(message: string, ...extra: unknown[]): void
  warn(message: string, ...extra: unknown[]): void
  error(message: string, ...extra: unknown[]): void
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, ...e) => write('debug', scope, m, e),
    info: (m, ...e) => write('info', scope, m, e),
    warn: (m, ...e) => write('warn', scope, m, e),
    error: (m, ...e) => write('error', scope, m, e)
  }
}
