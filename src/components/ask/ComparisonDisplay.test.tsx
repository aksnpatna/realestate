import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComparisonDisplay } from './ComparisonDisplay';

const makeMetric = (label: string, value: number, unit = '$') => ({
  label, value, unit, is_stale: false,
});

const comparisons = [
  {
    suburb_id: 'qld_kenmore',
    name: 'Kenmore',
    metrics: [
      makeMetric('Median House Price', 1250000),
      makeMetric('Median House Rent', 650, '$/week'),
      makeMetric('Gross House Yield', 2.7, '%'),
    ],
  },
  {
    suburb_id: 'vic_glen_waverley',
    name: 'Glen Waverley',
    metrics: [
      makeMetric('Median House Price', 1650000),
      makeMetric('Median House Rent', 720, '$/week'),
      makeMetric('Gross House Yield', 2.27, '%'),
    ],
  },
];

describe('ComparisonDisplay', () => {
  it('renders metric rows', () => {
    render(<ComparisonDisplay comparisons={comparisons} />);
    const matches = screen.getAllByText('Median House Price');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$1,250,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$1,650,000').length).toBeGreaterThanOrEqual(1);
  });

  it('renders winner column for multi-comparison', () => {
    render(<ComparisonDisplay comparisons={comparisons} />);
    expect(screen.getByText('Edge')).toBeDefined();
  });

  it('renders with evidence as_of badges', () => {
    const withEvidence = [
      { id: 'ev1', metric: 'Median House Price', value: 1250000, unit: '$', as_of: '2026-06', source: 'NPG', quality: 'verified', is_stale: false },
    ];
    render(<ComparisonDisplay comparisons={comparisons} evidence={withEvidence} />);
    expect(screen.getByText('Verified 2026-06')).toBeDefined();
  });

  it('renders stale indicator', () => {
    const stale = { ...comparisons[0] };
    stale.metrics = [
      { label: 'Median House Price', value: 1250000, unit: '$', is_stale: true },
      { label: 'Vacancy Rate', value: 1.5, unit: '%', is_stale: false },
    ];
    render(<ComparisonDisplay comparisons={[stale]} />);
    expect(screen.getAllByText('stale data').length).toBeGreaterThanOrEqual(1);
  });

  it('renders nothing for empty comparisons', () => {
    const { container } = render(<ComparisonDisplay comparisons={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
