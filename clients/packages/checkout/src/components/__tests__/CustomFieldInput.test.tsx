import { CustomField } from '@polar-sh/sdk/models/components/customfield.js'
import { Form } from '@polar-sh/ui/components/ui/form'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import CustomFieldInput from '../CustomFieldInput'

// Test wrapper component to provide form context
const TestWrapper = ({
  children,
  defaultValues = {},
}: {
  children: React.ReactNode
  defaultValues?: any
}) => {
  const form = useForm({ defaultValues })
  return (
    <Form {...form}>
      <form>{children}</form>
    </Form>
  )
}

describe('CustomFieldInput', () => {
  describe('Text Field', () => {
    const textField: CustomField = {
      type: 'text',
      name: 'text_field',
      properties: {
        formLabel: 'Text Input',
        formHelpText: 'Help text for input',
        formPlaceholder: 'Enter text',
        minLength: 2,
        maxLength: 10,
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      id: 'text-field-1',
      metadata: {},
      organizationId: 'org-1',
      slug: 'text-field',
    }

    it('renders text input with label and help text', () => {
      act(() => {
        render(
          <TestWrapper>
            <CustomFieldInput
              customField={textField}
              required={true}
              field={{
                onChange: jest.fn(),
                value: '',
                name: 'text_field',
                onBlur: jest.fn(),
                ref: jest.fn(),
              }}
            />
          </TestWrapper>,
        )
      })

      expect(screen.getByText('Text Input')).toBeInTheDocument()
      expect(screen.getByText('Help text for input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
    })

    it('handles text input changes', async () => {
      const onChange = jest.fn()
      act(() => {
        render(
          <TestWrapper>
            <CustomFieldInput
              customField={textField}
              required={true}
              field={{
                onChange,
                value: '',
                name: 'text_field',
                onBlur: jest.fn(),
                ref: jest.fn(),
              }}
            />
          </TestWrapper>,
        )
      })

      await act(async () => {
        await userEvent.type(screen.getByRole('textbox'), 'test input')
      })
      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('Number Field', () => {
    const numberField: CustomField = {
      type: 'number',
      name: 'number_field',
      properties: {
        formLabel: 'Number Input',
        formHelpText: 'Enter a number',
        formPlaceholder: '0',
        ge: 0,
        le: 100,
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      id: 'number-field-1',
      metadata: {},
      organizationId: 'org-1',
      slug: 'number-field',
    }

    it('renders number input with constraints', () => {
      act(() => {
        render(
          <TestWrapper>
            <CustomFieldInput
              customField={numberField}
              required={true}
              field={{
                onChange: jest.fn(),
                value: '',
                name: 'number_field',
                onBlur: jest.fn(),
                ref: jest.fn(),
              }}
            />
          </TestWrapper>,
        )
      })

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('max', '100')
    })
  })

  describe('Checkbox Field', () => {
    const checkboxField: CustomField = {
      type: 'checkbox',
      name: 'checkbox_field',
      properties: {
        formLabel: 'Accept terms',
        formHelpText: 'Please accept the terms',
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      id: 'checkbox-field-1',
      metadata: {},
      organizationId: 'org-1',
      slug: 'checkbox-field',
    }

    it('renders checkbox with label', () => {
      act(() => {
        render(
          <TestWrapper>
            <CustomFieldInput
              customField={checkboxField}
              required={true}
              field={{
                onChange: jest.fn(),
                value: false,
                name: 'checkbox_field',
                onBlur: jest.fn(),
                ref: jest.fn(),
              }}
            />
          </TestWrapper>,
        )
      })

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
      expect(screen.getByText('Accept terms')).toBeInTheDocument()
    })
  })

  describe('Select Field', () => {
    const selectField: CustomField = {
      type: 'select',
      name: 'select_field',
      properties: {
        formLabel: 'Select Option',
        formHelpText: 'Choose an option',
        formPlaceholder: 'Select...',
        options: [
          { label: 'Option 1', value: '1' },
          { label: 'Option 2', value: '2' },
        ],
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      id: 'select-field-1',
      metadata: {},
      organizationId: 'org-1',
      slug: 'select-field',
    }

    it('renders select with options', async () => {
      act(() => {
        render(
          <TestWrapper>
            <CustomFieldInput
              customField={selectField}
              required={true}
              field={{
                onChange: jest.fn(),
                value: '',
                name: 'select_field',
                onBlur: jest.fn(),
                ref: jest.fn(),
              }}
            />
          </TestWrapper>,
        )
      })

      const trigger = screen.getByRole('combobox')
      expect(trigger).toBeInTheDocument()

      // Open select
      await act(async () => {
        await userEvent.click(trigger)
      })

      // Check options
      expect(screen.getAllByText('Option 1')[0]).toBeInTheDocument()
      expect(screen.getAllByText('Option 2')[0]).toBeInTheDocument()
    })
  })

  describe('Date Field', () => {
    const dateField: CustomField = {
      type: 'date',
      name: 'date_field',
      properties: {
        formLabel: 'Date Input',
        formHelpText: 'Select a date',
        formPlaceholder: 'YYYY-MM-DD',
        ge: 1672531200, // 2023-01-01
        le: 1704067200, // 2024-01-01
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      id: 'date-field-1',
      metadata: {},
      organizationId: 'org-1',
      slug: 'date-field',
    }

    it('renders date input with constraints', () => {
      act(() => {
        render(
          <TestWrapper>
            <CustomFieldInput
              customField={dateField}
              required={true}
              field={{
                onChange: jest.fn(),
                value: '',
                name: 'date_field',
                onBlur: jest.fn(),
                ref: jest.fn(),
              }}
            />
          </TestWrapper>,
        )
      })

      const input = screen.getByPlaceholderText('YYYY-MM-DD')
      expect(input).toHaveAttribute('type', 'date')
      expect(input).toHaveAttribute('min', '2023-01-01')
      expect(input).toHaveAttribute('max', '2024-01-01')
    })
  })
})
