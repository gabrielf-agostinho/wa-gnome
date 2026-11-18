import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function writeFileAtomic(path: string, content: string, mode: number): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, content, { mode })
  renameSync(tmp, path)
}
