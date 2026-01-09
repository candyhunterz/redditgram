/**
 * Format a Unix timestamp to a relative time string (e.g., "2h ago", "3d ago")
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp

  if (diff < 60) {
    return 'just now'
  }

  const minutes = Math.floor(diff / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(diff / 3600)
  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(diff / 86400)
  if (days < 30) {
    return `${days}d ago`
  }

  const months = Math.floor(diff / (30 * 86400))
  if (months < 12) {
    return `${months}mo ago`
  }

  const years = Math.floor(diff / (365 * 86400))
  return `${years}y ago`
}

/**
 * Format a number with k/m suffix for thousands/millions
 * @param num - The number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  const absNum = Math.abs(num)
  const sign = num < 0 ? '-' : ''

  if (absNum < 1000) {
    return `${sign}${absNum}`
  }

  if (absNum < 1000000) {
    const formatted = (absNum / 1000).toFixed(1)
    // Remove trailing .0
    const cleaned = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted
    return `${sign}${cleaned}k`
  }

  const formatted = (absNum / 1000000).toFixed(1)
  const cleaned = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted
  return `${sign}${cleaned}m`
}
