import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RetryScheduler } from './retry'

describe('RetryScheduler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const create = (task = vi.fn()) => ({ task, retry: new RetryScheduler(task, { initialDelayMs: 100, maxDelayMs: 350 }) })

  it('runs the task after the current delay and doubles it up to the maximum', () => {
    const { task, retry } = create()
    expect(retry.schedule()).toBe(true)
    vi.advanceTimersByTime(99)
    expect(task).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(task).toHaveBeenCalledTimes(1)
    expect(retry.nextDelayMs).toBe(200)

    retry.schedule()
    vi.advanceTimersByTime(200)
    expect(retry.nextDelayMs).toBe(350)
    retry.schedule()
    vi.advanceTimersByTime(350)
    expect(retry.nextDelayMs).toBe(350)
    expect(task).toHaveBeenCalledTimes(3)
  })

  it('ignores schedule calls while one is pending', () => {
    const { task, retry } = create()
    retry.schedule()
    expect(retry.schedule()).toBe(false)
    expect(retry.pending).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(task).toHaveBeenCalledTimes(1)
    expect(retry.pending).toBe(false)
  })

  it('cancel drops the pending run and reset restores the initial delay', () => {
    const { task, retry } = create()
    retry.schedule()
    retry.cancel()
    vi.advanceTimersByTime(1000)
    expect(task).not.toHaveBeenCalled()
    expect(retry.nextDelayMs).toBe(200)
    retry.reset()
    expect(retry.nextDelayMs).toBe(100)
  })
})
