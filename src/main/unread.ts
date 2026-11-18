import { STRINGS } from '../shared/strings'

export function parseUnreadCount(title: string): number {
  const match = /^\((\d+)\)/.exec(title.trim())
  return match?.[1] ? Number.parseInt(match[1], 10) : 0
}

export function describeUnread(count: number): string {
  if (count === 0) return STRINGS.unread.none
  return count === 1 ? STRINGS.unread.one : STRINGS.unread.many(count)
}
