import type { Meta, StoryObj } from '@storybook/react'
import CustomFieldValue from './CustomFieldValue'

const meta: Meta<typeof CustomFieldValue> = {
  title: 'CustomFields/CustomFieldValue',
  component: CustomFieldValue,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof CustomFieldValue>

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
    return <CustomFieldValue {...args} />
  },
}

export const TextField: Story = {
  ...Default,
  args: {
    field: {
      ...baseCustomField,
      type: 'text',
    },
    value: 'Text Value',
  },
  argTypes: {
    value: {
      control: { type: 'text' },
    },
  },
}

export const NumberField: Story = {
  ...Default,
  args: {
    field: {
      ...baseCustomField,
      type: 'number',
    },
    value: 4242,
  },
  argTypes: {
    value: {
      control: { type: 'number' },
    },
  },
}

export const DateField: Story = {
  ...Default,
  args: {
    field: {
      ...baseCustomField,
      type: 'date',
    },
    value: '1991-06-02T00:00:00Z',
  },
  argTypes: {
    value: {
      control: { type: 'date' },
    },
  },
}

export const CheckboxFieldTrue: Story = {
  ...Default,
  args: {
    field: {
      ...baseCustomField,
      type: 'checkbox',
    },
    value: true,
  },
  argTypes: {
    value: {
      control: { type: 'boolean' },
    },
  },
}

export const CheckboxFieldFalse: Story = {
  ...CheckboxFieldTrue,
  args: {
    ...CheckboxFieldTrue.args,
    value: false,
  },
}

export const SelectField: Story = {
  ...Default,
  args: {
    field: {
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
    value: 'option-2',
  },
  argTypes: {
    value: {
      control: {
        type: 'select',
      },
      options: ['option-1', 'option-2', 'option-3', 'unknown'],
    },
  },
}

export const UndefinedValue: Story = {
  ...Default,
  args: {
    field: {
      ...baseCustomField,
      type: 'text',
    },
    value: undefined,
  },
}
