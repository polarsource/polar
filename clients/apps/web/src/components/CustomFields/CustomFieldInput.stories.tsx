import type { Meta, StoryObj } from '@storybook/react'
import { Form, FormField } from 'polarkit/components/ui/form'
import { useForm } from 'react-hook-form'
import CustomFieldInput from './CustomFieldInput'

const meta: Meta<typeof CustomFieldInput> = {
  title: 'CustomFields/CustomFieldInput',
  component: CustomFieldInput,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof CustomFieldInput>

const baseCustomField = {
  id: '00000000-0000-0000-0000-000000000000',
  created_at: '2023-06-29T00:00:00Z',
  modified_at: null,
  name: 'Custom Field',
  slug: 'custom-field',
  organization_id: '00000000-0000-0000-0000-000000000000',
  metadata: {},
  properties: {
    form_label: 'Field Label',
    form_help_text: 'This is a help text',
    form_placeholder: 'Placeholder',
  },
}
const Default: Story = {
  render: (args) => {
    const form = useForm()
    const { control } = form
    return (
      <Form {...form}>
        <FormField
          control={control}
          name="customField"
          // @ts-ignore
          render={({ field }) => <CustomFieldInput {...args} field={field} />}
        />
      </Form>
    )
  },
}

export const TextField: Story = {
  ...Default,
  args: {
    customField: {
      ...baseCustomField,
      type: 'text',
    },
    required: false,
  },
}

export const TextareaField: Story = {
  ...Default,
  args: {
    customField: {
      ...baseCustomField,
      type: 'text',
      properties: {
        ...baseCustomField.properties,
        textarea: true,
      },
    },
    required: false,
  },
}

export const NumberField: Story = {
  ...Default,
  args: {
    customField: {
      ...baseCustomField,
      type: 'number',
    },
    required: false,
  },
}

export const DateField: Story = {
  ...Default,
  args: {
    customField: {
      ...baseCustomField,
      type: 'date',
    },
    required: false,
  },
}

export const CheckboxField: Story = {
  ...Default,
  args: {
    customField: {
      ...baseCustomField,
      type: 'checkbox',
    },
    required: false,
  },
}

export const SelectField: Story = {
  ...Default,
  args: {
    customField: {
      ...baseCustomField,
      type: 'select',
      properties: {
        ...baseCustomField.properties,
        options: [
          { label: 'Option 1', value: 'option-1' },
          { label: 'Option 2', value: 'option-2' },
          { label: 'Option 3', value: 'option-3' },
        ],
      },
    },
    required: false,
  },
}

export const MarkdownLabels: Story = {
  ...Default,
  args: {
    customField: {
      ...baseCustomField,
      type: 'checkbox',
      properties: {
        ...baseCustomField.properties,
        form_label:
          'I accept the [terms and conditions](https://example.com/terms)',
        form_help_text:
          'This is **required** by our *picky* lawyers. It annoys `devs` like us.',
      },
    },
    required: true,
  },
}
