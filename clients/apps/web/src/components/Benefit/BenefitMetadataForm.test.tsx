import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactNode, useEffect } from 'react'
import { FormProvider, UseFormReturn, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BenefitMetadataForm } from './BenefitMetadataForm'

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@polar-sh/orbit', () => ({
  Button: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode
    value: string
    onValueChange: (value: string) => void
  }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}))

type Metadata = Record<string, string | number | boolean>
type FormValues = { metadata: Metadata }

const renderForm = (metadata: Metadata) => {
  let form: UseFormReturn<FormValues> | undefined
  const Harness = () => {
    const methods = useForm<FormValues>({ defaultValues: { metadata } })
    useEffect(() => {
      form = methods
    }, [methods])
    return (
      <FormProvider {...methods}>
        <BenefitMetadataForm />
      </FormProvider>
    )
  }
  render(<Harness />)
  return () => form!
}

const getRowControls = () => {
  const [typeSelect, valueSelect] =
    screen.getAllByRole<HTMLSelectElement>('combobox')
  const [keyInput] = screen.getAllByRole<HTMLInputElement>('textbox')
  return {
    typeSelect,
    valueSelect,
    keyInput,
    numberInput: screen.queryByRole<HTMLInputElement>('spinbutton'),
  }
}

describe('BenefitMetadataForm', () => {
  afterEach(() => {
    cleanup()
  })

  it('stores numbers and booleans with their native types', () => {
    const getForm = renderForm({})

    fireEvent.click(screen.getByText('Add Metadata'))
    fireEvent.change(getRowControls().keyInput, { target: { value: 'limit' } })
    expect(getForm().getValues('metadata')).toEqual({ limit: '' })

    fireEvent.change(getRowControls().typeSelect, {
      target: { value: 'number' },
    })
    fireEvent.change(getRowControls().numberInput!, {
      target: { value: '42.5' },
    })
    expect(getForm().getValues('metadata')).toEqual({ limit: 42.5 })

    fireEvent.change(getRowControls().typeSelect, {
      target: { value: 'boolean' },
    })
    expect(getForm().getValues('metadata')).toEqual({ limit: true })

    fireEvent.change(getRowControls().valueSelect, {
      target: { value: 'false' },
    })
    expect(getForm().getValues('metadata')).toEqual({ limit: false })

    fireEvent.change(getRowControls().typeSelect, {
      target: { value: 'string' },
    })
    expect(getForm().getValues('metadata')).toEqual({ limit: 'false' })
  })

  it('renders existing values with a control matching their type', () => {
    renderForm({ enabled: true, seats: 3, plan: 'pro' })

    const [enabledType, enabledValue, seatsType, planType] =
      screen.getAllByRole<HTMLSelectElement>('combobox')
    expect(enabledType.value).toBe('boolean')
    expect(enabledValue.value).toBe('true')
    expect(seatsType.value).toBe('number')
    expect(screen.getByRole<HTMLInputElement>('spinbutton').value).toBe('3')
    expect(planType.value).toBe('string')
    expect(screen.getByDisplayValue('pro')).toBeDefined()
  })

  it('rejects an empty number value on validation', async () => {
    const getForm = renderForm({ seats: 3 })

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } })
    expect(Number.isNaN(getForm().getValues('metadata').seats)).toBe(true)

    expect(await getForm().trigger('metadata')).toBe(false)
    expect(
      await screen.findByText('Number values must be valid numbers'),
    ).toBeDefined()
  })
})
