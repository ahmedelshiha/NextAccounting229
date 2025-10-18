'use client'

/**
 * EnvironmentBadge Component
 * 
 * Display current environment (production/staging/development) with
 * color coding, icons, and tooltips for warnings.
 * 
 * @module @/components/admin/layout/Footer/EnvironmentBadge
 */

import { useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  getEnvironment,
  getEnvironmentColor,
  getEnvironmentLabel,
  getEnvironmentDescription,
  isProduction,
} from '@/lib/admin/environment'
import type { EnvironmentBadgeProps } from './types'

/**
 * Color class mapping for Tailwind
 */
const BADGE_COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
}

export function EnvironmentBadge({
  compact = false,
  hideProduction = true,
}: EnvironmentBadgeProps) {
  // Detect environment
  const environment = useMemo(() => getEnvironment(), [])
  const color = useMemo(() => getEnvironmentColor(environment), [environment])
  const label = useMemo(() => getEnvironmentLabel(environment), [environment])
  const description = useMemo(
    () => getEnvironmentDescription(environment),
    [environment]
  )

  // Hide production badge if configured
  if (hideProduction && isProduction(environment)) {
    return null
  }

  const colorClass = BADGE_COLORS[color] || BADGE_COLORS.orange
  const badge = (
    <Badge title={description} className={`${colorClass} border flex items-center gap-1 px-2 py-0.5`}>
      {!compact && environment === 'production' && (
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
      )}
      {compact ? label.slice(0, 3) : label}
    </Badge>
  )

  return badge
}

export default EnvironmentBadge
