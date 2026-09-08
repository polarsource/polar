import { cleanup, render, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MetadataFormValues } from './utils'

// The per-row type `<Select>` is the only `<Select>` whose `value` is one of
// the type strings; capture its `onValueChange` so the test can drive type
// changes exactly as the live component would.
let typeSelectOnValueChange: ((value: string) => void) | null = null

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@polar-sh/orbit', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode
    value?: string
    onValueChange?: (v: string) => void
  }) => {
    if (value === 'string' || value === 'number' || value === 'boolean') {
      typeSelectOnValueChange = onValueChange ?? null
    }
    return (
      <div data-value={value ?? ''} data-testid="select">
        {children}
      </div>
    )
  },
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: () => null,
}))

const { MetadataForm } = await import('./MetadataForm')
const { entriesToMetadata } = await import('./utils')

const typeSelectValue = () =>
  document.querySelector<HTMLElement>('[data-testid="select"]')?.dataset.value
const valueInput = () =>
  document.querySelector('input[placeholder="value"]') as HTMLInputElement
const flush = () => new Promise((r) => setTimeout(r, 0))

const Harness = ({
  values,
  onSubmit,
}: {
  values: MetadataFormValues
  onSubmit?: (d: MetadataFormValues) => void
}) => {
  const form = useForm<MetadataFormValues>({ defaultValues: values })
  return (
    <FormProvider {...form}>
      <MetadataForm />
      <button
        type="button"
        onClick={form.handleSubmit((data) => onSubmit?.(data))}
        data-testid="submit"
      >
        submit
      </button>
    </FormProvider>
  )
}

const submit = () =>
  (
    document.querySelector('[data-testid="submit"]') as HTMLButtonElement
  ).click()

describe('MetadataForm type-change reset', () => {
  afterEach(() => {
    cleanup()
    typeSelectOnValueChange = null
  })

  it('does not launder an empty number into the literal "NaN" on String -> Number -> String', async () => {
    const captured: string[] = []
    render(
      <Harness
        values={{ metadata: [{ key: 'plan', value: '' }] }}
        onSubmit={(d) =>
          captured.push(JSON.stringify(entriesToMetadata(d.metadata)))
        }
      />,
    )
    await waitFor(() => expect(typeSelectValue()).toBe('string'))
    typeSelectOnValueChange!('number')
    await waitFor(() => expect(typeSelectValue()).toBe('number'))
    typeSelectOnValueChange!('string')
    await waitFor(() => expect(typeSelectValue()).toBe('string'))
    expect(valueInput().value).toBe('')
    submit()
    await flush()
    expect(captured).toEqual([])
  })

  it('resets the field to a fresh default for the new type instead of coercing', async () => {
    render(<Harness values={{ metadata: [{ key: 'plan', value: 5 }] }} />)
    await waitFor(() => expect(typeSelectValue()).toBe('number'))
    typeSelectOnValueChange!('string')
    await waitFor(() => expect(typeSelectValue()).toBe('string'))
    expect(valueInput().value).toBe('')
    typeSelectOnValueChange!('boolean')
    await waitFor(() => expect(typeSelectValue()).toBe('boolean'))
    expect(
      document.querySelectorAll<HTMLElement>('[data-testid="select"]')[1]
        .dataset.value,
    ).toBe('false')
  })

  it('blocks submit for a number-typed NaN row (validator guard intact)', async () => {
    let calls = 0
    render(
      <Harness
        values={{ metadata: [{ key: 'plan', value: Number.NaN }] }}
        onSubmit={() => {
          calls += 1
        }}
      />,
    )
    await waitFor(() => expect(typeSelectValue()).toBe('number'))
    submit()
    await flush()
    expect(calls).toBe(0)
  })
})
