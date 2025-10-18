import packageJson from '../../../package.json'

/**
 * Admin Dashboard Version Utilities
 *
 * Provides version and build information for the admin footer.
 * Detects app version from environment variables, package.json, or fallback defaults.
 *
 * @module @/lib/admin/version
 */

/**
 * Get the current application version
 * 
 * Priority:
 * 1. NEXT_PUBLIC_APP_VERSION environment variable
 * 2. package.json version (with 'v' prefix)
 * 3. Fallback: 'v0.0.0'
 * 
 * @returns Version string in format "v2.3.2"
 */
export function getAppVersion(): string {
  // Check environment variable first
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_VERSION) {
    const envVersion = process.env.NEXT_PUBLIC_APP_VERSION
    return envVersion.startsWith('v') ? envVersion : `v${envVersion}`
  }

  // Try to get from package.json (imported as JSON)
  try {
    // package.json is imported at build time; ensure resolveJsonModule is enabled in tsconfig
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if ((packageJson as any)?.version) {
      // Ensure version has leading 'v'
      const v = (packageJson as any).version as string
      return v.startsWith('v') ? v : `v${v}`
    }
  } catch {
    // package.json import failed, continue to fallback
  }

  // Fallback version
  return 'v0.0.0'
}

/**
 * Format a date string to human-readable format
 * 
 * @param dateString ISO date string or empty string
 * @returns Formatted date like "Sept 26, 2025" or "Development"
 */
function formatDate(dateString: string): string {
  if (!dateString || dateString.trim() === '') {
    return 'Development'
  }

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return 'Development'
    }

    // Format: "Sept 26, 2025"
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' })
    const dayFormatter = new Intl.DateTimeFormat('en-US', { day: 'numeric' })
    const yearFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric' })

    const month = monthFormatter.format(date)
    const day = dayFormatter.format(date)
    const year = yearFormatter.format(date)

    return `${month} ${day}, ${year}`
  } catch {
    return 'Development'
  }
}

/**
 * Get the build date in human-readable format
 * 
 * @returns Formatted date like "Sept 26, 2025" or "Development" if not available
 */
export function getBuildDate(): string {
  if (typeof process === 'undefined') {
    return 'Development'
  }

  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE || ''
  return formatDate(buildDate)
}

/**
 * Format a time string to HH:MM format
 * 
 * @param timeString ISO time string or empty string
 * @returns Formatted time like "14:32" or empty string
 */
function formatTime(timeString: string): string {
  if (!timeString || timeString.trim() === '') {
    return ''
  }

  try {
    const date = new Date(timeString)
    if (isNaN(date.getTime())) {
      return ''
    }

    // Format: "14:32" (HH:MM)
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    return timeFormatter.format(date)
  } catch {
    return ''
  }
}

/**
 * Get the build time in HH:MM format
 * 
 * @returns Formatted time like "14:32" or empty string if not available
 */
export function getBuildTime(): string {
  if (typeof process === 'undefined') {
    return ''
  }

  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || ''
  return formatTime(buildTime)
}

/**
 * Get complete build information as a formatted string
 * Useful for debugging and footer display
 * 
 * @returns Complete build info like "v2.3.2 • Sept 26, 2025 • 14:32"
 */
export function getCompleteBuildInfo(): string {
  const version = getAppVersion()
  const date = getBuildDate()
  const time = getBuildTime()

  const parts = [version, date]
  if (time) {
    parts.push(time)
  }

  return parts.join(' • ')
}

/**
 * Check if running in development mode
 * 
 * @returns true if NODE_ENV is 'development'
 */
export function isDevelopment(): boolean {
  if (typeof process === 'undefined') {
    return false
  }
  return process.env.NODE_ENV === 'development'
}

/**
 * Check if running in production mode
 * 
 * @returns true if NODE_ENV is 'production'
 */
export function isProduction(): boolean {
  if (typeof process === 'undefined') {
    return false
  }
  return process.env.NODE_ENV === 'production'
}

/**
 * Get full version and environment info string
 * Used for error reporting and logging
 * 
 * @returns String like "v2.3.2 (Production)" or "v2.3.2 (Development)"
 */
export function getVersionString(): string {
  const version = getAppVersion()
  const env = isProduction() ? 'Production' : 'Development'
  return `${version} (${env})`
}
