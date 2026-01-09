import { formatRelativeTime, formatNumber } from './format-time'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should return "just now" for times less than a minute ago', () => {
    const thirtySecondsAgo = Math.floor(Date.now() / 1000) - 30
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now')
  })

  it('should return minutes ago for times less than an hour', () => {
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago')

    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60
    expect(formatRelativeTime(oneMinuteAgo)).toBe('1m ago')
  })

  it('should return hours ago for times less than a day', () => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')

    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600
    expect(formatRelativeTime(oneHourAgo)).toBe('1h ago')
  })

  it('should return days ago for times less than a month', () => {
    const threeDaysAgo = Math.floor(Date.now() / 1000) - (3 * 86400)
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')

    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400
    expect(formatRelativeTime(oneDayAgo)).toBe('1d ago')
  })

  it('should return months ago for times less than a year', () => {
    const twoMonthsAgo = Math.floor(Date.now() / 1000) - (60 * 86400)
    expect(formatRelativeTime(twoMonthsAgo)).toBe('2mo ago')
  })

  it('should return years ago for older times', () => {
    const twoYearsAgo = Math.floor(Date.now() / 1000) - (730 * 86400)
    expect(formatRelativeTime(twoYearsAgo)).toBe('2y ago')
  })
})

describe('formatNumber', () => {
  it('should return number as-is for values under 1000', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(500)).toBe('500')
  })

  it('should format thousands with k suffix', () => {
    expect(formatNumber(1000)).toBe('1k')
    expect(formatNumber(1500)).toBe('1.5k')
    expect(formatNumber(9999)).toBe('10k')
    expect(formatNumber(25600)).toBe('25.6k')
  })

  it('should format millions with m suffix', () => {
    expect(formatNumber(1000000)).toBe('1m')
    expect(formatNumber(1500000)).toBe('1.5m')
    expect(formatNumber(2300000)).toBe('2.3m')
  })

  it('should handle negative numbers', () => {
    expect(formatNumber(-500)).toBe('-500')
    expect(formatNumber(-1500)).toBe('-1.5k')
  })
})
