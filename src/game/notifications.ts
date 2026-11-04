export interface Notice { id: string; severity: string }

export class NoticeQueue<T extends Notice = Notice> {
  private waiting: T[] = []
  private active: { value: T; until: number }[] = []
  get visible(): T[] { return this.active.map(x => x.value) }
  enqueue(value: T, now: number): void {
    this.waiting.push(value)
    this.fill(now)
  }
  dismiss(id: string, now: number): void {
    this.active = this.active.filter(x => x.value.id !== id)
    this.fill(now)
  }
  advance(now: number): void {
    this.active = this.active.filter(x => now < x.until)
    this.fill(now)
  }
  reset(): void { this.waiting = []; this.active = [] }
  private fill(now: number): void {
    while (this.active.length < 3 && this.waiting.length) {
      const value = this.waiting.shift()!
      this.active.push({ value, until: value.severity === 'critical' ? Infinity : now + 6000 })
    }
  }
}
