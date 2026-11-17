import { describe, expect, it } from 'vitest'
import { describeUnread, parseUnreadCount } from './unread'

describe('parseUnreadCount', () => {
  it('reads the count WhatsApp puts in the title', () => {
    expect(parseUnreadCount('(3) WhatsApp')).toBe(3)
    expect(parseUnreadCount('(120) WhatsApp')).toBe(120)
    expect(parseUnreadCount(' (1) WhatsApp')).toBe(1)
  })

  it('returns 0 when there is no count', () => {
    expect(parseUnreadCount('WhatsApp')).toBe(0)
    expect(parseUnreadCount('')).toBe(0)
    expect(parseUnreadCount('WhatsApp (3)')).toBe(0)
    expect(parseUnreadCount('(abc) WhatsApp')).toBe(0)
  })
})

describe('describeUnread', () => {
  it('pluralises in Portuguese', () => {
    expect(describeUnread(0)).toBe('Nenhuma conversa não lida')
    expect(describeUnread(1)).toBe('1 conversa não lida')
    expect(describeUnread(5)).toBe('5 conversas não lidas')
  })
})
