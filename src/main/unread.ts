export function parseUnreadCount(title: string): number {
  const match = /^\((\d+)\)/.exec(title.trim())
  return match?.[1] ? Number.parseInt(match[1], 10) : 0
}

export function describeUnread(count: number): string {
  if (count === 0) return 'Nenhuma conversa não lida'
  return count === 1 ? '1 conversa não lida' : `${count} conversas não lidas`
}
