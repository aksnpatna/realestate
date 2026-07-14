import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AffordabilityCalculator from './AffordabilityCalculator'

describe('AffordabilityCalculator', () => {
  it('shows maximum purchase price and planning scope', () => {
    render(<AffordabilityCalculator />)
    expect(screen.getByText('Price Ceiling Calculator')).toBeInTheDocument()
    const priceLabels = screen.getAllByText('Maximum Purchase Price')
    expect(priceLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('does not show suburb ranking table', () => {
    render(<AffordabilityCalculator />)
    expect(screen.queryByText(/Suburbs You Can Afford/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Growth Score/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Sort by:/i)).not.toBeInTheDocument()
  })

  it('has Buy Finder handoff button', () => {
    render(<AffordabilityCalculator />)
    expect(screen.getByText(/Open Buy Finder/i)).toBeInTheDocument()
  })
})
