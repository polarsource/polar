import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Filter, FilterOption } from './FilterPopover'

vi.mock('@polar-sh/orbit', () => ({
  Button: ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  ),
  Text: ({ children, as }: { children: ReactNode; as?: string }) => {
    const Tag = (as ?? 'span') as 'span'
    return <Tag>{children}</Tag>
  },
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@polar-sh/ui/components/ui/command', () => {
  const Passthrough = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  )
  return {
    Command: Passthrough,
    CommandGroup: Passthrough,
    CommandInput: () => null,
    CommandItem: ({
      children,
      onSelect,
      value,
    }: {
      children: ReactNode
      onSelect?: () => void
      value?: string
    }) => (
      <div data-testid="command-item" data-value={value} onClick={onSelect}>
        {children}
      </div>
    ),
    CommandList: Passthrough,
    CommandSeparator: () => null,
  }
})

vi.mock('@polar-sh/ui/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => (
    <div data-testid="popover">{children}</div>
  ),
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: ReactNode }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
}))

vi.mock('lucide-react', () => ({
  CheckIcon: ({ className }: { className?: string }) => {
    const visible = className ? !className.includes('invisible') : true
    return (
      <span
        data-testid="check-icon"
        data-visible={visible ? 'true' : 'false'}
      />
    )
  },
}))

vi.mock('tailwind-merge', () => ({
  twMerge: (...args: Array<string | false | undefined>) =>
    args.filter(Boolean).join(' '),
}))

const FilterPopoverModule = await import('./FilterPopover')
const FilterPopover = FilterPopoverModule.default

const PREDEFINED_OPTIONS: FilterOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'allTime', label: 'All Time' },
]

const buildSingleFilter = (
  overrides: Partial<{
    options: FilterOption[]
    value: string | null
  }> = {},
): Filter => ({
  key: 'date',
  label: 'Date',
  type: 'single',
  options: overrides.options ?? PREDEFINED_OPTIONS,
  value: overrides.value ?? null,
  onChange: vi.fn(),
})

const renderPopover = (filters: Filter[]) =>
  render(<FilterPopover filters={filters} />)

const openSubMenu = (filterLabel: string) => {
  const items = screen.getAllByTestId('command-item')
  const subMenuTrigger = items.find((item) => {
    const spans = within(item).queryAllByText(filterLabel, { exact: true })
    return spans.length > 0
  })
  if (!subMenuTrigger) {
    throw new Error(
      `Could not find sub-menu trigger for filter "${filterLabel}"`,
    )
  }
  fireEvent.click(subMenuTrigger)
}

const findItemByLabel = (label: string) => {
  const items = screen.getAllByTestId('command-item')
  return items.find(
    (item) => within(item).queryAllByText(label, { exact: true }).length > 0,
  )
}

describe('FilterPopover', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows the active-filter badge count when a single filter has a non-null value', () => {
    renderPopover([buildSingleFilter({ value: 'today' })])
    expect(screen.getByText('1')).not.toBeNull()
  })

  it('does not show a badge when no filters are active', () => {
    renderPopover([buildSingleFilter({ value: null })])
    expect(screen.queryByText('1')).toBeNull()
  })

  it('renders the option label as the summary on the main list when the value matches an option', () => {
    renderPopover([buildSingleFilter({ value: 'thisMonth' })])
    expect(screen.getByText('This Month')).not.toBeNull()
  })

  it('shows no summary text for an orphaned value with no matching option (reproduces the bug)', () => {
    const orphanedFilter = buildSingleFilter({ value: 'custom' })
    renderPopover([orphanedFilter])
    expect(screen.queryByText('custom')).toBeNull()
    expect(screen.queryByText('Jan 15 – Feb 20')).toBeNull()
  })

  it('shows the formatted custom range as the summary when the custom option is present (verifies the fix)', () => {
    const fixedFilter = buildSingleFilter({
      value: 'custom',
      options: [
        ...PREDEFINED_OPTIONS,
        { value: 'custom', label: 'Jan 15 – Feb 20' },
      ],
    })
    renderPopover([fixedFilter])
    expect(screen.getByText('Jan 15 – Feb 20')).not.toBeNull()
  })

  it('shows no checkmark on any option for an orphaned value when the sub-menu is open (reproduces the bug)', () => {
    const orphanedFilter = buildSingleFilter({ value: 'custom' })
    renderPopover([orphanedFilter])
    openSubMenu('Date')
    const subMenuItems = screen.getAllByTestId('command-item')
    expect(subMenuItems.length).toBeGreaterThan(0)
    const visibleChecks = subMenuItems.filter(
      (item) =>
        within(item)
          .queryByTestId('check-icon')
          ?.getAttribute('data-visible') === 'true',
    )
    expect(visibleChecks).toHaveLength(0)
  })

  it('shows a checkmark on the custom option when the custom option is present (verifies the fix)', () => {
    const fixedFilter = buildSingleFilter({
      value: 'custom',
      options: [
        ...PREDEFINED_OPTIONS,
        { value: 'custom', label: 'Jan 15 – Feb 20' },
      ],
    })
    renderPopover([fixedFilter])
    openSubMenu('Date')
    const customItem = findItemByLabel('Jan 15 – Feb 20')
    expect(customItem).toBeDefined()
    const customCheck = within(customItem!).queryByTestId('check-icon')
    expect(customCheck?.getAttribute('data-visible')).toBe('true')
    const todayItem = findItemByLabel('Today')
    const todayCheck = within(todayItem!).queryByTestId('check-icon')
    expect(todayCheck?.getAttribute('data-visible')).toBe('false')
  })

  it('shows a checkmark on the selected predefined interval', () => {
    const filter = buildSingleFilter({ value: 'today' })
    renderPopover([filter])
    openSubMenu('Date')
    const todayItem = findItemByLabel('Today')
    const todayCheck = within(todayItem!).queryByTestId('check-icon')
    expect(todayCheck?.getAttribute('data-visible')).toBe('true')
  })

  it('renders a multi-filter summary of "N selected" for multiple values', () => {
    const multiFilter: Filter = {
      key: 'product',
      label: 'Product',
      type: 'multi',
      options: [
        { value: 'p1', label: 'Product A' },
        { value: 'p2', label: 'Product B' },
        { value: 'p3', label: 'Product C' },
      ],
      value: ['p1', 'p2'],
      onChange: vi.fn(),
    }
    renderPopover([multiFilter])
    expect(screen.getByText('2 selected')).not.toBeNull()
  })

  it('renders the single selected option label for a multi-filter with one value', () => {
    const multiFilter: Filter = {
      key: 'product',
      label: 'Product',
      type: 'multi',
      options: [
        { value: 'p1', label: 'Product A' },
        { value: 'p2', label: 'Product B' },
      ],
      value: ['p2'],
      onChange: vi.fn(),
    }
    renderPopover([multiFilter])
    expect(screen.getByText('Product B')).not.toBeNull()
  })
})
