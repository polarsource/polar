import { schemas } from '@polar-sh/client'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import Textarea from '@polar-sh/ui/components/atoms/TextArea'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx'
import { ControllerRenderProps } from 'react-hook-form'

const markdownOptions: MarkdownToJSX.Options = {
  disableParsingRawHTML: true,
  forceBlock: false,
  overrides: {
    h1: (props) => <span {...props} />,
    h2: (props) => <span {...props} />,
    h3: (props) => <span {...props} />,
    h4: (props) => <span {...props} />,
    h5: (props) => <span {...props} />,
    h6: (props) => <span {...props} />,
    p: (props) => <span {...props} />,
    embed: () => <></>,
    iframe: () => <></>,
    img: () => <></>,
    a: (props) => (
      <a
        {...props}
        rel="noopener noreferrer nofollow"
        target="_blank"
        className="text-blue-400 hover:underline"
      />
    ),
  },
}

const FieldLabel = ({
  customField,
}: {
  customField: schemas['CustomField']
}) => {
  return (
    <FormLabel>
      {customField.properties.form_label ? (
        <Markdown options={markdownOptions}>
          {customField.properties.form_label}
        </Markdown>
      ) : (
        customField.name
      )}
    </FormLabel>
  )
}

const FieldHelpText = ({
  customField,
}: {
  customField: schemas['CustomField']
}) => {
  return customField.properties.form_help_text ? (
    <FormDescription>
      <Markdown options={markdownOptions}>
        {customField.properties.form_help_text}
      </Markdown>
    </FormDescription>
  ) : null
}

interface CustomFieldTextInputProps {
  customField: schemas['CustomFieldText']
  required: boolean
  field: ControllerRenderProps
}

const CustomFieldTextInput: React.FC<CustomFieldTextInputProps> = ({
  customField,
  required,
  field,
}) => {
  if (customField.properties.textarea) {
    return (
      <Textarea
        {...field}
        placeholder={customField.properties.form_placeholder}
        required={required}
        minLength={customField.properties.min_length}
        maxLength={customField.properties.max_length}
      />
    )
  }

  return (
    <Input
      {...field}
      className="bg-white shadow-xs"
      type="text"
      placeholder={customField.properties.form_placeholder}
      required={required}
      minLength={customField.properties.min_length}
      maxLength={customField.properties.max_length}
    />
  )
}

interface CustomFieldNumberInputProps {
  customField: schemas['CustomFieldNumber']
  required: boolean
  field: ControllerRenderProps
}

const CustomFieldNumberInput: React.FC<CustomFieldNumberInputProps> = ({
  customField,
  required,
  field,
}) => {
  return (
    <Input
      {...field}
      type="number"
      className="bg-white shadow-xs"
      placeholder={customField.properties.form_placeholder}
      required={required}
      min={customField.properties.ge}
      max={customField.properties.le}
    />
  )
}

interface CustomFieldDateInputProps {
  customField: schemas['CustomFieldDate']
  required: boolean
  field: ControllerRenderProps
}

const CustomFieldDateInput: React.FC<CustomFieldDateInputProps> = ({
  customField,
  required,
  field,
}) => {
  const { ge, le } = customField.properties
  const min = ge ? new Date(ge * 1000).toISOString().slice(0, 10) : undefined
  const max = le ? new Date(le * 1000).toISOString().slice(0, 10) : undefined

  return (
    <Input
      {...field}
      type={'date'}
      className="bg-white shadow-xs"
      placeholder={customField.properties.form_placeholder}
      required={required}
      min={min}
      max={max}
    />
  )
}

interface CustomFieldCheckboxInputProps {
  customField: schemas['CustomFieldCheckbox']
  required: boolean
  field: ControllerRenderProps
}

const CustomFieldCheckboxInput: React.FC<CustomFieldCheckboxInputProps> = ({
  customField,
  required,
  field,
}) => {
  return (
    <FormItem>
      <div className="flex flex-row items-center space-y-0 space-x-3">
        <FormControl>
          <Checkbox
            defaultChecked={field.value}
            onCheckedChange={field.onChange}
            required={required}
          />
        </FormControl>
        <FieldLabel customField={customField} />
      </div>
      <FormMessage />
      <FieldHelpText customField={customField} />
    </FormItem>
  )
}

interface CustomFieldSelectInputProps {
  customField: schemas['CustomFieldSelect']
  required: boolean
  field: ControllerRenderProps
}

const CustomFieldSelectInput: React.FC<CustomFieldSelectInputProps> = ({
  customField,
  required,
  field,
}) => {
  return (
    <Select
      onValueChange={field.onChange}
      defaultValue={field.value}
      required={required}
    >
      <SelectTrigger>
        <SelectValue placeholder={customField.properties.form_placeholder} />
      </SelectTrigger>
      <SelectContent>
        {customField.properties.options.map(({ label, value }) => (
          <SelectItem key={value} value={value} textValue={label}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const getInputComponent = (customField: schemas['CustomField']) => {
  switch (customField.type) {
    case 'text':
      return CustomFieldTextInput
    case 'number':
      return CustomFieldNumberInput
    case 'date':
      return CustomFieldDateInput
    case 'checkbox':
      return CustomFieldCheckboxInput
    case 'select':
      return CustomFieldSelectInput
  }
}

interface CustomFieldInputProps {
  customField: schemas['CustomField']
  required: boolean
  field: ControllerRenderProps
}

const CustomFieldInput: React.FC<CustomFieldInputProps> = ({
  customField,
  required,
  field,
}) => {
  const InputComponent = getInputComponent(customField)

  if (customField.type === 'checkbox') {
    return (
      <CustomFieldCheckboxInput
        customField={customField}
        required={required}
        field={field}
      />
    )
  }

  return (
    <FormItem>
      <FieldLabel customField={customField} />
      <FormControl>
        <InputComponent
          // @ts-ignore
          customField={customField}
          required={required}
          field={field}
        />
      </FormControl>
      <FormMessage />
      <FieldHelpText customField={customField} />
    </FormItem>
  )
}

export default CustomFieldInput
