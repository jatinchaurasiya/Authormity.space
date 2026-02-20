import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes without conflicts.
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs))
}

/**
 * Format numbers with K/M suffix.
 */
export function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
}

/**
 * Calculate engagement rate.
 */
export function calcEngagementRate(
    likes: number,
    comments: number,
    shares: number,
    impressions: number
): number {
    if (!impressions) return 0
    return parseFloat((((likes + comments + shares) / impressions) * 100).toFixed(2))
}

/**
 * Generate a random 8-character alphanumeric referral code.
 */
export function generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase()
}

/**
 * Count words in a string.
 */
export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Truncate text to a max length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength).trimEnd() + '…'
}

/**
 * Format date for display.
 */
export function formatDate(dateString: string): string {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(new Date(dateString))
}

/**
 * Format date + time for display.
 */
export function formatDateTime(dateString: string): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(new Date(dateString))
}

/**
 * Get relative time string ("2 hours ago", "in 3 days").
 */
export function getRelativeTime(dateString: string): string {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    const diff = (new Date(dateString).getTime() - Date.now()) / 1000

    if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second')
    if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute')
    if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
    if (Math.abs(diff) < 2592000) return rtf.format(Math.round(diff / 86400), 'day')
    return rtf.format(Math.round(diff / 2592000), 'month')
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch {
        return false
    }
}

/**
 * Debounce a function.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout>
    return (...args: Parameters<T>) => {
        clearTimeout(timer)
        timer = setTimeout(() => fn(...args), delay)
    }
}

/**
 * Sleep for given milliseconds.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
