export interface RetrySchedulerOptions {
  initialDelayMs: number
  maxDelayMs: number
}

export class RetryScheduler {
  private delayMs: number
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly task: () => void,
    private readonly options: RetrySchedulerOptions
  ) {
    this.delayMs = options.initialDelayMs
  }

  get nextDelayMs(): number {
    return this.delayMs
  }

  get pending(): boolean {
    return this.timer !== null
  }

  schedule(): boolean {
    if (this.timer) return false
    const delay = this.delayMs
    this.delayMs = Math.min(this.delayMs * 2, this.options.maxDelayMs)
    this.timer = setTimeout(() => {
      this.timer = null
      this.task()
    }, delay)
    return true
  }

  reset(): void {
    this.delayMs = this.options.initialDelayMs
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
