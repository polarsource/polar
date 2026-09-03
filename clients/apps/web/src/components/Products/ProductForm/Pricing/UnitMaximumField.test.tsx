import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { type Control, FormProvider, useForm, useWatch } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@polar-sh/orbit', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}))

const { UnitMaximumField } = await import('./UnitMaximumField')

type Tier = { bound: number | null; unit_amount: number }

type Values = {
  prices: {
    id: string
    minimum_units: number | null
    tiers: { type: string; tiers: Tier[] }
  }[]
}

const Tiers = ({ control }: { control: Control<Values> }) => (
  <pre data-testid="tiers">
    {JSON.stringify(useWatch({ control, name: 'prices.0.tiers.tiers' }))}
  </pre>
)

const Harness = ({
  tiers,
  minimumUnits = null,
}: {
  tiers: Tier[]
  minimumUnits?: number | null
}) => {
  const form = useForm<Values>({
    defaultValues: {
      prices: [
        {
          id: 'price_1',
          minimum_units: minimumUnits,
          tiers: { type: 'volume', tiers },
        },
      ],
    },
  })
  return (
    <FormProvider {...form}>
      <Tiers control={form.control} />
      <form data-testid="form" onSubmit={form.handleSubmit(() => {})}>
        <UnitMaximumField index={0} unitLabelPlural="devices" />
      </form>
    </FormProvider>
  )
}

const flat: Tier[] = [{ bound: null, unit_amount: 1000 }]
const tiered: Tier[] = [
  { bound: 10, unit_amount: 1000 },
  { bound: null, unit_amount: 800 },
]
const cappedTiered: Tier[] = [
  { bound: 10, unit_amount: 1000 },
  { bound: 250, unit_amount: 800 },
]

const maximumInput = () =>
  screen.getByLabelText('Maximum devices') as HTMLInputElement
const tiersJson = () => screen.getByTestId('tiers').textContent

describe('UnitMaximumField', () => {
  afterEach(cleanup)

  it('reads as unlimited when the last tier is unbounded', () => {
    render(<Harness tiers={flat} />)

    expect(maximumInput().value).toBe('')
    expect(maximumInput().placeholder).toBe('Unlimited')
  })

  it('shows the last tier bound as the maximum', () => {
    render(<Harness tiers={cappedTiered} />)

    expect(maximumInput().value).toBe('250')
  })

  it('caps a flat price by bounding its only tier', () => {
    render(<Harness tiers={flat} />)

    fireEvent.change(maximumInput(), { target: { value: '100' } })

    expect(tiersJson()).toBe(
      JSON.stringify([{ bound: 100, unit_amount: 1000 }]),
    )
  })

  it('caps a tiered price by bounding its last tier', () => {
    render(<Harness tiers={tiered} />)

    fireEvent.change(maximumInput(), { target: { value: '500' } })

    expect(tiersJson()).toBe(
      JSON.stringify([
        { bound: 10, unit_amount: 1000 },
        { bound: 500, unit_amount: 800 },
      ]),
    )
  })

  it('clears back to unlimited', () => {
    render(<Harness tiers={cappedTiered} />)

    fireEvent.change(maximumInput(), { target: { value: '' } })

    expect(tiersJson()).toBe(
      JSON.stringify([
        { bound: 10, unit_amount: 1000 },
        { bound: null, unit_amount: 800 },
      ]),
    )
  })

  it('rejects a maximum at or below the tier beneath it', async () => {
    render(<Harness tiers={tiered} />)

    fireEvent.change(maximumInput(), { target: { value: '10' } })
    fireEvent.blur(maximumInput())

    expect(await screen.findByText(/greater than 10/)).toBeTruthy()
  })

  it('rejects a maximum well below the tier beneath it', async () => {
    render(
      <Harness
        tiers={[
          { bound: 1000, unit_amount: 1000 },
          { bound: null, unit_amount: 800 },
        ]}
      />,
    )

    fireEvent.change(maximumInput(), { target: { value: '12' } })
    fireEvent.blur(maximumInput())

    expect(await screen.findByText(/greater than 1,?000/)).toBeTruthy()
  })

  it('rejects a maximum below the minimum', async () => {
    render(<Harness tiers={flat} minimumUnits={5} />)

    fireEvent.change(maximumInput(), { target: { value: '3' } })
    fireEvent.blur(maximumInput())

    expect(await screen.findByText(/at least the minimum of 5/)).toBeTruthy()
  })
})
