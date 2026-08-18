import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@polar-sh/orbit', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Switch: ({
    id,
    checked,
    disabled,
    onCheckedChange,
  }: {
    id?: string
    checked?: boolean
    disabled?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      type="checkbox"
      role="switch"
      id={id}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Select: ({
    children,
    value,
    disabled,
  }: {
    children: ReactNode
    value?: string
    disabled?: boolean
  }) => (
    <div
      data-testid="meter-interval"
      data-value={value ?? ''}
      data-disabled={disabled ? 'true' : 'false'}
    >
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: () => null,
}))

const { MeterCycleField } = await import('./MeterCycleField')

type Values = {
  recurring_interval: 'day' | 'week' | 'month' | 'year' | null
  recurring_interval_count: number | null
  meter_interval?: 'day' | 'week' | 'month' | 'year' | null
  meter_interval_count?: number | null
}

const Harness = ({
  values,
  disabled,
}: {
  values: Values
  disabled?: boolean
}) => {
  const form = useForm<Values>({ defaultValues: values })
  return (
    <FormProvider {...form}>
      <MeterCycleField disabled={disabled} />
    </FormProvider>
  )
}

const yearly: Values = {
  recurring_interval: 'year',
  recurring_interval_count: 1,
}

describe('MeterCycleField', () => {
  afterEach(cleanup)

  it('hides the interval inputs until the meter cycle is enabled', () => {
    render(<Harness values={yearly} />)

    expect(screen.queryByTestId('meter-interval')).toBeNull()
  })

  it('defaults to a monthly meter cycle on yearly billing', () => {
    render(<Harness values={yearly} />)

    fireEvent.click(screen.getByRole('switch'))

    expect(screen.getByTestId('meter-interval').dataset.value).toBe('month')
  })

  it('reports a meter cycle that does not divide the billing cycle', () => {
    render(
      <Harness
        values={{ ...yearly, meter_interval: 'month', meter_interval_count: 5 }}
      />,
    )

    expect(
      screen.getByText(/must evenly divide the billing cycle/),
    ).toBeTruthy()
  })

  it('accepts a meter cycle that divides the billing cycle', () => {
    render(
      <Harness
        values={{ ...yearly, meter_interval: 'month', meter_interval_count: 6 }}
      />,
    )

    expect(
      screen.queryByText(/must evenly divide the billing cycle/),
    ).toBeNull()
  })

  it('locks the inputs on an existing product', () => {
    render(
      <Harness
        values={{ ...yearly, meter_interval: 'month', meter_interval_count: 1 }}
        disabled
      />,
    )

    expect(screen.getByRole('switch').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('meter-interval').dataset.disabled).toBe('true')
  })
})
