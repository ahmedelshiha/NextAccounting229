import React from 'react'
import { render, screen } from '@testing-library/react'
import Page from '@/app/admin/services/page'

describe('Admin Services page component', () => {
  it('renders header and primary actions', () => {
    render(React.createElement(Page) as any)
    expect(screen.getByText('Services Management')).toBeTruthy()
    expect(screen.getByText('Manage your service offerings, pricing, and availability')).toBeTruthy()
    expect(screen.getByText('New Service')).toBeTruthy()
    expect(screen.getByText('Export')).toBeTruthy()
    expect(screen.getByText('Filters')).toBeTruthy()
  })
})
