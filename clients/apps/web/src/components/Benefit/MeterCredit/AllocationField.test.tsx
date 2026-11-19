import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Form } from '@polar-sh/ui/components/ui/form'
import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { expect, it } from 'vitest'
import { MeterCreditAllocationField } from './AllocationField'

type Values = {
  properties: { allocation?: schemas['BenefitMeterCreditAllocation'] }
}

const Harness = ({
  defaultValues = { properties: {} },
  apiErrors = [],
}: {
  defaultValues?: Values
  apiErrors?: schemas['ValidationError'][]
}) => {
  const form = useForm<Values>({ defaultValues })
  const { setError } = form
  useEffect(() => {
    setValidationErrors(apiErrors, setError)
  }, [apiErrors, setError])
  return (
    <Form {...form}>
      <form>
        <MeterCreditAllocationField />
      </form>
    </Form>
  )
}

it('selects per claimed seat by default', () => {
  render(<Harness />)

  expect(screen.getByRole('radio', { name: /per claimed seat/i })).toBeChecked()
  expect(screen.getByRole('radio', { name: /per team/i })).not.toBeChecked()
})

it('selects the current allocation of an existing benefit', () => {
  render(<Harness defaultValues={{ properties: { allocation: 'team' } }} />)

  expect(screen.getByRole('radio', { name: /per team/i })).toBeChecked()
})

it('shows the API error when the allocation can no longer be changed', () => {
  const message =
    "The allocation can't be changed once the benefit has been granted. Create a new benefit instead."

  render(
    <Harness
      defaultValues={{ properties: { allocation: 'team' } }}
      apiErrors={[
        {
          loc: ['body', 'properties', 'allocation'],
          msg: message,
          type: 'value_error',
        },
      ]}
    />,
  )

  expect(screen.getByText(message)).toBeVisible()
})
