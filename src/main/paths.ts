import { join } from 'node:path'
import { app } from 'electron'

export function resourcePath(...parts: string[]): string {
  const base = app.isPackaged ? process.resourcesPath : join(__dirname, '..', '..')
  return join(base, 'resources', ...parts)
}

export function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}
