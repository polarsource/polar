import type { CustomField } from '@polar-sh/sdk/models/components/customfield'
import type { CustomFieldCheckbox } from '@polar-sh/sdk/models/components/customfieldcheckbox'
import type { CustomFieldDate } from '@polar-sh/sdk/models/components/customfielddate'
import type { CustomFieldNumber } from '@polar-sh/sdk/models/components/customfieldnumber'
import type { CustomFieldSelect } from '@polar-sh/sdk/models/components/customfieldselect'
import type { CustomFieldText } from '@polar-sh/sdk/models/components/customfieldtext'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import type { MarkdownToJSX } from 'markdown-to-jsx'
import Markdown from 'markdown-to-jsx'
import { useCallback, useState } from 'react'
import type { ControllerRenderProps } from 'react-hook-form'

const markdownOptions: MarkdownToJSX.Options = {
  disableParsingRawHTML: true,
  forceBlock: false,
  overrides: {
    h1: (props: any) => <span {...props} />,
    h2: (props: any) => <span {...props} />,
    h3: (props: any) => <span {...props} />,
    h4: (props: any) => <span {...props} />,
    h5: (props: any) => <span {...props} />,
    h6: (props: any) => <span {...props} />,
    p: (props: any) => <span {...props} />,
    embed: () => <></>,
    iframe: () => <></>,
    img: () => <></>,
    a: (props: any) => (
      <a
        {...props}
        rel="noopener noreferrer nofollow"
        target="_blank"
        className="text-blue-400 hover:underline"
      />
    ),
  },
}

const FieldLabel = ({ customField }: { customField: CustomField }) => {
  return (
    <FormLabel>
      {customField.properties.formLabel ? (
        <Markdown options={markdownOptions}>
          {customField.properties.formLabel}
        </Markdown>
      ) : (
        customField.name
      )}
    </FormLabel>
  )
}

const FieldHelpText = ({ customField }: { customField: CustomField }) => {
  return customField.properties.formHelpText ? (
    <FormDescription>
      <Markdown options={markdownOptions}>
        {customField.properties.formHelpText}
      </Markdown>
    </FormDescription>
  ) : null
}

interface CustomFieldTextInputProps {
  customField: CustomFieldText
  required: boolean
  field: ControllerRenderProps
  themePreset: ThemingPresetProps
}

const CustomFieldTextInput: React.FC<CustomFieldTextInputProps> = ({
  customField,
  required,
  field,
  themePreset,
}) => {
  if (customField.properties.textarea) {
    return (
      <TextArea
        {...field}
        placeholder={customField.properties.formPlaceholder}
        required={required}
        minLength={customField.properties.minLength}
        maxLength={customField.properties.maxLength}
      />
    )
  }

  return (
    <Input
      {...field}
      className={themePreset.polar.input}
      type="text"
      placeholder={customField.properties.formPlaceholder}
      required={required}
      minLength={customField.properties.minLength}
      maxLength={customField.properties.maxLength}
    />
  )
}

interface CustomFieldNumberInputProps {
  customField: CustomFieldNumber
  required: boolean
  field: ControllerRenderProps
  themePreset: ThemingPresetProps
}

const CustomFieldNumberInput: React.FC<CustomFieldNumberInputProps> = ({
  customField,
  required,
  field,
  themePreset,
}) => {
  return (
    <Input
      {...field}
      type="number"
      className={themePreset.polar.input}
      placeholder={customField.properties.formPlaceholder}
      required={required}
      min={customField.properties.ge}
      max={customField.properties.le}
    />
  )
}

interface CustomFieldDateInputProps {
  customField: CustomFieldDate
  required: boolean
  field: ControllerRenderProps
  themePreset: ThemingPresetProps
}

const CustomFieldDateInput: React.FC<CustomFieldDateInputProps> = ({
  customField,
  required,
  field,
  themePreset,
}) => {
  const { ge, le } = customField.properties
  const min = ge ? new Date(ge * 1000).toISOString().slice(0, 10) : undefined
  const max = le ? new Date(le * 1000).toISOString().slice(0, 10) : undefined

  return (
    <Input
      {...field}
      type={'date'}
      className={themePreset.polar.input}
      placeholder={customField.properties.formPlaceholder}
      required={required}
      min={min}
      max={max}
    />
  )
}

interface CustomFieldCheckboxInputProps {
  customField: CustomFieldCheckbox
  required: boolean
  field: ControllerRenderProps
  themePreset: ThemingPresetProps
}

const CustomFieldCheckboxInput: React.FC<CustomFieldCheckboxInputProps> = ({
  customField,
  required,
  field,
  themePreset,
}) => {
  return (
    <FormItem>
      <div className="flex flex-row items-center space-x-3 space-y-0">
        <FormControl>
          <Checkbox
            defaultChecked={field.value}
            onCheckedChange={field.onChange}
            required={required}
            className={themePreset.polar.checkbox}
          />
        </FormControl>
        {/* @ts-ignore */}
        <FieldLabel customField={customField} />
      </div>
      <FormMessage />
      {/* @ts-ignore */}
      <FieldHelpText customField={customField} />
    </FormItem>
  )
}

interface CustomFieldSelectInputProps {
  customField: CustomFieldSelect
  required: boolean
  field: ControllerRenderProps
}

const CustomFieldSelectInput: React.FC<CustomFieldSelectInputProps> = ({
  customField,
  required,
  field,
}) => {
  const [isOtherSelected, setIsOtherSelected] = useState(
    field.value === 'other',
  )

  const [otherValue, setOtherValue] = useState('')

  const handleSelectChange = useCallback(
    (value: string) => {
      if (value === 'other') {
        setIsOtherSelected(true)
      } else {
        setIsOtherSelected(false)
        field.onChange(value)
      }
    },
    [field],
  )

  const handleOtherInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setOtherValue(value)

      if (value) {
        field.onChange(value)
      } else if (required) {
        field.onChange('')
      } else {
        field.onChange('other')
      }
    },
    [field, required],
  )

  const handleInputBlur = useCallback(() => {
    if (!otherValue && required) {
      field.onChange('')
    }
  }, [otherValue, field, required])

  const displayValue = isOtherSelected ? 'other' : field.value

  return (
  <div className="space-y-4">
    <Select
      onValueChange={handleSelectChange}
      value={displayValue || ''}
      required={required}
    >
      <SelectTrigger>
        <SelectValue placeholder={customField.properties.formPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {customField.properties.options.map(({ label, value }) => (
          <SelectItem key={value} value={value} textValue={label}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    {isOtherSelected && (
      <Input
        type="text"
        placeholder="Please specify"
        value={otherValue}
        onChange={handleOtherInputChange}
        onBlur={handleInputBlur}
        required={required}
      />
    )}
  </div>
  )
}

const getInputComponent = (customField: CustomField) => {
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
  customField: CustomField
  required: boolean
  field: ControllerRenderProps
  themePreset: ThemingPresetProps
}

const CustomFieldInput: React.FC<CustomFieldInputProps> = ({
  customField,
  required,
  field,
  themePreset,
}) => {
  const InputComponent = getInputComponent(customField)

  if (customField.type === 'checkbox') {
    return (
      <CustomFieldCheckboxInput
        customField={customField}
        required={required}
        field={field}
        themePreset={themePreset}
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
          themePreset={themePreset}
        />
      </FormControl>
      <FormMessage />
      <FieldHelpText customField={customField} />
    </FormItem>
  )
}

export default CustomFieldInput
