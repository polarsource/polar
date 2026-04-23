import type { schemas } from '@polar-sh/client'
import { render, screen } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import type { ControllerRenderProps } from 'react-hook-form'
import { FormProvider, useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import CustomFieldInput from './CustomFieldInput'

const baseField: ControllerRenderProps = {
  name: 'custom_field_data.test_field',
  value: '',
  onChange: vi.fn(),
  onBlur: vi.fn(),
  ref: vi.fn(),
}

function FormWrapper({ children }: PropsWithChildren) {
  const form = useForm()
  return <FormProvider {...form}>{children}</FormProvider>
}

const baseProps = {
  created_at: new Date().toISOString(),
  modified_at: null,
  id: 'cf_1',
  metadata: {},
  slug: 'test_field',
  name: 'Test Field',
  organization_id: 'org_1',
} as const

function makeTextField(
  overrides?: Partial<schemas['CustomFieldText']['properties']>,
): schemas['CustomFieldText'] {
  return {
    ...baseProps,
    type: 'text',
    properties: {
      form_label: undefined,
      form_help_text: undefined,
      form_placeholder: undefined,
      textarea: undefined,
      min_length: undefined,
      max_length: undefined,
      ...overrides,
    },
  }
}

function makeNumberField(
  overrides?: Partial<schemas['CustomFieldNumber']['properties']>,
): schemas['CustomFieldNumber'] {
  return {
    ...baseProps,
    type: 'number',
    properties: {
      form_label: undefined,
      form_help_text: undefined,
      form_placeholder: undefined,
      ge: undefined,
      le: undefined,
      ...overrides,
    },
  }
}

function makeDateField(
  overrides?: Partial<schemas['CustomFieldDate']['properties']>,
): schemas['CustomFieldDate'] {
  return {
    ...baseProps,
    type: 'date',
    properties: {
      form_label: undefined,
      form_help_text: undefined,
      form_placeholder: undefined,
      ge: undefined,
      le: undefined,
      ...overrides,
    },
  }
}

function makeCheckboxField(
  overrides?: Partial<schemas['CustomFieldCheckbox']['properties']>,
): schemas['CustomFieldCheckbox'] {
  return {
    ...baseProps,
    type: 'checkbox',
    properties: {
      form_label: undefined,
      form_help_text: undefined,
      form_placeholder: undefined,
      ...overrides,
    },
  }
}

function makeSelectField(
  options: Array<{ value: string; label: string }>,
  overrides?: Partial<schemas['CustomFieldSelect']['properties']>,
): schemas['CustomFieldSelect'] {
  return {
    ...baseProps,
    type: 'select',
    properties: {
      form_label: undefined,
      form_help_text: undefined,
      form_placeholder: undefined,
      options,
      ...overrides,
    },
  }
}

describe('CustomFieldInput', () => {
  describe('text field', () => {
    it('renders a text input', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField()}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders field name as label when no form_label', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField()}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByText('Test Field')).toBeInTheDocument()
    })

    it('renders form_label as markdown when provided', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField({ form_label: '**Bold Label**' })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByText('Bold Label')).toBeInTheDocument()
    })

    it('rewrites markdown headings to spans', () => {
      const headings = [
        '# h1',
        '## h2',
        '### h3',
        '#### h4',
        '##### h5',
        '###### h6',
      ].join('\n\n')

      const { container } = render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField({ form_label: headings })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
        expect(container.querySelector(tag)).toBeNull()
      }
      expect(container.querySelectorAll('span').length).toBeGreaterThan(0)
    })

    it('rewrites markdown paragraphs to spans', () => {
      const { container } = render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField({ form_label: 'just some text' })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(container.querySelector('p')).toBeNull()
    })

    it('renders markdown links with safe rel/target attributes', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField({
              form_label: '[click](https://example.com)',
            })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      const link = screen.getByRole('link', { name: 'click' })
      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    })

    it('strips markdown images entirely', () => {
      const { container } = render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField({
              form_label: '![alt text](https://example.com/img.png)',
            })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(container.querySelector('img')).toBeNull()
    })

    it('renders help text when provided', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField({ form_help_text: 'Enter your name' })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByText('Enter your name')).toBeInTheDocument()
    })

    it('renders placeholder when provided', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField({ form_placeholder: 'Type here...' })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument()
    })

    it('renders textarea when textarea property is true', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField({ textarea: true })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
    })

    it('sets minLength and maxLength attributes', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField({ min_length: 3, max_length: 100 })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('minlength', '3')
      expect(input).toHaveAttribute('maxlength', '100')
    })

    it('sets required attribute', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeTextField()}
            required={true}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByRole('textbox')).toBeRequired()
    })
  })

  describe('number field', () => {
    it('renders a number input', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeNumberField()}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    })

    it('sets min and max attributes', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeNumberField({ ge: 0, le: 999 })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('max', '999')
    })
  })

  describe('date field', () => {
    it('renders a date input', () => {
      const { container } = render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeDateField()}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      const input = container.querySelector('input[type="date"]')
      expect(input).toBeInTheDocument()
    })

    it('converts unix timestamp constraints to date strings', () => {
      const ge = Date.UTC(2025, 0, 1) / 1000 // 2025-01-01
      const le = Date.UTC(2025, 11, 31) / 1000 // 2025-12-31

      const { container } = render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeDateField({ ge, le })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      const input = container.querySelector('input[type="date"]')
      expect(input).toHaveAttribute('min', '2025-01-01')
      expect(input).toHaveAttribute('max', '2025-12-31')
    })
  })

  describe('checkbox field', () => {
    it('renders a checkbox', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeCheckboxField()}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('renders label next to checkbox', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeCheckboxField({ form_label: 'I agree' })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByText('I agree')).toBeInTheDocument()
      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('renders help text for checkbox', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeCheckboxField({
              form_help_text: 'Required to proceed',
            })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByText('Required to proceed')).toBeInTheDocument()
    })
  })

  describe('select field', () => {
    it('renders a select trigger', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeSelectField([
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' },
            ])}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('renders placeholder in select', () => {
      render(
        <FormWrapper>
          <CustomFieldInput
            customField={makeSelectField([{ value: 'a', label: 'Option A' }], {
              form_placeholder: 'Choose one...',
            })}
            required={false}
            field={baseField}
          />
        </FormWrapper>,
      )

      expect(screen.getByText('Choose one...')).toBeInTheDocument()
    })
  })
})
