/**
 * AdminDashboardLayout Component
 * Main layout wrapper for admin dashboard with fixed sidebar architecture
 * 
 * @author NextAccounting Admin Dashboard
 * @version 1.0.0
 */

'use client'

import React, { useEffect, useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'
import AdminFooter from './AdminFooter'
import AdminErrorBoundary from './AdminErrorBoundary'
import { useResponsive } from '@/hooks/admin/useResponsive'
import { useSidebarCollapsed, useSidebarActions } from '@/stores/admin/layout.store.selectors'
import type { AdminDashboardLayoutProps } from '@/types/admin/layout'

/**
 * AdminDashboardLayout - The main layout component for admin dashboard
 * 
 * This component implements the new fixed sidebar architecture that resolves
 * navigation conflicts by providing a dedicated admin-only layout system.
 * 
 * Key Features:
 * - Fixed sidebar navigation (no longer floating)
 * - Responsive design with mobile/tablet/desktop variants
 * - State management integration with Zustand store
 * - Proper content area management without layout shifts
 * - Accessibility compliance with ARIA labels and focus management
 * 
 * Architecture:
 * - Desktop: Fixed sidebar (256px) + content area with margin-left
 * - Tablet: Collapsible sidebar with push behavior
 * - Mobile: Overlay sidebar with backdrop
 */
const AdminDashboardLayout: React.FC<AdminDashboardLayoutProps> = ({
  children,
  session,
  initialSidebarCollapsed = false,
  className = '',
}) => {
  const pathname = usePathname()

  // Get responsive state and use unified sidebar store
  const responsive = useResponsive()
  const sidebarCollapsed = useSidebarCollapsed()
  const { setCollapsed } = useSidebarActions()

  // Add client-side hydration check to prevent SSR issues
  const [isClient, setIsClient] = useState(false)

  // Set client-side flag after hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Auto-collapse sidebar on mobile/tablet breakpoints
  useEffect(() => {
    const { isMobile, isTablet } = responsive
    if (isMobile || isTablet) {
      setCollapsed(true)
    }
  }, [responsive.breakpoint, responsive.isMobile, responsive.isTablet, setCollapsed])

  // Initialize collapsed state if provided as prop
  useEffect(() => {
    if (initialSidebarCollapsed !== undefined) {
      setCollapsed(initialSidebarCollapsed)
    }
  }, [initialSidebarCollapsed, setCollapsed])

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setCollapsed(!sidebarCollapsed)
  }, [sidebarCollapsed, setCollapsed])

  // Handle mobile sidebar close
  const handleMobileSidebarClose = useCallback(() => {
    // On mobile, close is handled by collapsing
    setCollapsed(true)
  }, [setCollapsed])

  // Calculate content area classes based on responsive state and sidebar state
  const getContentClasses = useCallback(() => {
    const { isMobile } = responsive

    if (isMobile) {
      // On mobile, content takes full width (sidebar overlays)
      return 'ml-0'
    } else {
      // On desktop/tablet, content adjusts based on collapsed state with smooth transition
      return `transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`
    }
  }, [responsive, sidebarCollapsed])

  // Show loading skeleton during SSR/hydration
  if (!isClient) {
    return (
      <div className="h-screen bg-gray-50 flex">
        {/* Sidebar Skeleton */}
        <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
          <div className="animate-pulse">
            <div className="p-4 border-b border-gray-200">
              <div className="h-8 bg-gray-300 rounded"></div>
            </div>
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-8 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="flex-1">
          <div className="h-16 bg-white border-b border-gray-200"></div>
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-300 rounded w-1/4"></div>
              <div className="h-32 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AdminErrorBoundary>
      <div className={`h-screen bg-gray-50 overflow-hidden ${className}`}>
        {/* Accessibility: Skip link for keyboard users */}
        <a
          href="#admin-main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:bg-white focus:text-blue-600 focus:ring-2 focus:ring-blue-600 focus:px-3 focus:py-2 focus:z-[60] rounded"
          onClick={(e) => {
            e.preventDefault()
            const el = document.getElementById('admin-main-content')
            if (el) {
              el.focus({ preventScroll: false })
            }
          }}
        >
          Skip to main content
        </a>

      {/* Admin Sidebar - Fixed positioning with responsive behavior */}
      <AdminSidebar
        isCollapsed={sidebar.collapsed}
        isMobile={responsive.isMobile}
        onClose={handleMobileSidebarClose}
      />

      {/* Mobile Backdrop */}
      {responsive.isMobile && sidebar.open && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
          onClick={handleMobileSidebarClose}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <div className={`min-h-full flex flex-col transition-all duration-300 ${getContentClasses()}`}>
        {/* Admin Header */}
        <AdminHeader
          onMenuToggle={handleSidebarToggle}
          isMobileMenuOpen={sidebar.open}
        />

        {/* Scrollable Content */}
        <main
          id="admin-main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-6 py-4 focus:outline-none"
          role="main"
          aria-label="Admin dashboard content"
        >
          <div className="max-w-7xl mx-auto">
            {/* Loading State */}
            {ui.isLoading && (
              <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <span className="ml-3 text-gray-600">Loading...</span>
              </div>
            )}

            {/* Error State */}
            {ui.error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="mt-1 text-sm text-red-700">{ui.error}</p>
                  </div>
                  <div className="ml-auto pl-3">
                    <div className="-mx-1.5 -my-1.5">
                      <button
                        type="button"
                        onClick={() => ui.setError(null)}
                        className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                        aria-label="Dismiss error"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content */}
            {children}
          </div>
        </main>

        {/* Admin Footer */}
        <AdminFooter
          sidebarCollapsed={sidebar.collapsed}
          isMobile={responsive.isMobile}
        />
      </div>

      {/* Debug Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-50 font-mono">
          <div>Breakpoint: {responsive.breakpoint}</div>
          <div>Sidebar: {sidebar.collapsed ? 'collapsed' : 'expanded'}</div>
          <div>Mobile: {responsive.isMobile ? 'yes' : 'no'}</div>
        </div>
      )}
    </div>
    </AdminErrorBoundary>
  )
}

export default AdminDashboardLayout
