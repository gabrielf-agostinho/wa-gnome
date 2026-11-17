import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger, disableFileLogging, enableFileLogging, formatLine, rotateLogFile } from './logger'

function tempLog(): string {
  return join(mkdtempSync(join(tmpdir(), 'wa-gnome-log-')), 'logs', 'wa-gnome.log')
}

afterEach(() => {
  disableFileLogging()
  vi.restoreAllMocks()
})

describe('formatLine', () => {
  it('formats strings and inspects other values, including error stacks', () => {
    const line = formatLine(new Date('2026-01-02T03:04:05Z'), 'warn', 'x', 'hello', ['a', { b: 1 }, new Error('boom')])
    expect(line.startsWith("2026-01-02T03:04:05.000Z [WARN] [x] hello a { b: 1 } Error: boom")).toBe(true)
    expect(line).toContain('logger.test.ts')
  })
})

describe('rotateLogFile', () => {
  it('shifts generations and drops the oldest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wa-gnome-rot-'))
    const path = join(dir, 'app.log')
    writeFileSync(path, 'current')
    writeFileSync(`${path}.1`, 'one')
    writeFileSync(`${path}.2`, 'two')
    rotateLogFile(path, 2)
    expect(existsSync(path)).toBe(false)
    expect(readFileSync(`${path}.1`, 'utf8')).toBe('current')
    expect(readFileSync(`${path}.2`, 'utf8')).toBe('one')
    expect(existsSync(`${path}.3`)).toBe(false)
  })
})

describe('file logging', () => {
  it('creates the directory and appends lines with private permissions', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const path = tempLog()
    enableFileLogging(path)
    createLogger('test').info('first')
    createLogger('test').info('second')
    const lines = readFileSync(path, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatch(/\[INFO\] \[test\] second$/)
    expect(statSync(path).mode & 0o777).toBe(0o600)
  })

  it('rotates when the size limit is reached', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const path = tempLog()
    enableFileLogging(path, { maxBytes: 200, keep: 2 })
    const log = createLogger('test')
    for (let i = 0; i < 10; i++) log.info(`line ${i} ${'x'.repeat(40)}`)
    expect(statSync(path).size).toBeLessThanOrEqual(200)
    expect(existsSync(`${path}.1`)).toBe(true)
    expect(existsSync(`${path}.2`)).toBe(true)
    expect(existsSync(`${path}.3`)).toBe(false)
    expect(readFileSync(path, 'utf8')).toContain('line 9')
  })

  it('rotates an oversized file left by a previous run', () => {
    const path = tempLog()
    enableFileLogging(path)
    disableFileLogging()
    writeFileSync(path, 'x'.repeat(300))
    enableFileLogging(path, { maxBytes: 200 })
    expect(existsSync(path)).toBe(false)
    expect(readFileSync(`${path}.1`, 'utf8')).toHaveLength(300)
  })
})
