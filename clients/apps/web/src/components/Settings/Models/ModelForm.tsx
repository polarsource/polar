import { schemas } from '@polar-sh/client'
import { Input } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import Switch from '@polar-sh/ui/components/atoms/Switch'

type CreateOrUpdate =
  | schemas['LLMProviderConfigCreate']
  | schemas['LLMProviderConfigUpdate']

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'cohere', label: 'Cohere' },
]

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'o3',
    'o3-mini',
    'o4-mini',
  ],
  anthropic: [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-haiku-4-20250414',
  ],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  azure: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  mistral: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'codestral-latest',
  ],
  cohere: ['command-r-plus', 'command-r', 'command-a-03-2025'],
}

export const FieldProvider = () => {
  const { control, setValue } = useFormContext<CreateOrUpdate>()

  return (
    <FormField
      control={control}
      name="provider"
      rules={{ required: 'This field is required' }}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1">
          <FormLabel>Provider</FormLabel>
          <FormControl>
            <Select
              {...field}
              value={field.value || undefined}
              onValueChange={(v) => {
                field.onChange(v)
                setValue('model_name', '')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

const CUSTOM_VALUE = '__custom__'

export const FieldModelName = () => {
  const { control, watch } = useFormContext<CreateOrUpdate>()
  const provider = watch('provider')
  const suggestions = (provider && MODELS_BY_PROVIDER[provider]) || []
  const [isCustom, setIsCustom] = useState(false)

  return (
    <FormField
      control={control}
      name="model_name"
      rules={{ required: 'This field is required' }}
      render={({ field }) => {
        const showSelect = suggestions.length > 0 && !isCustom

        return (
          <FormItem className="flex flex-col gap-1">
            <FormLabel>Model Name</FormLabel>
            <FormControl>
              {showSelect ? (
                <Select
                  value={
                    suggestions.includes(field.value || '')
                      ? field.value || undefined
                      : undefined
                  }
                  onValueChange={(v) => {
                    if (v === CUSTOM_VALUE) {
                      setIsCustom(true)
                      field.onChange('')
                    } else {
                      field.onChange(v)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {suggestions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_VALUE}>
                      Custom model...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  {...field}
                  value={field.value || ''}
                  placeholder="e.g. gpt-4o, claude-sonnet-4-20250514"
                />
              )}
            </FormControl>
            {isCustom && suggestions.length > 0 && (
              <FormDescription>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => {
                    setIsCustom(false)
                    field.onChange('')
                  }}
                >
                  Back to suggested models
                </button>
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

export const FieldDisplayName = () => {
  const { control } = useFormContext<CreateOrUpdate>()

  return (
    <FormField
      control={control}
      name="display_name"
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1">
          <FormLabel>Display Name</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value || ''}
              placeholder="Optional display name"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export const FieldApiKey = ({ placeholder }: { placeholder?: string }) => {
  const { control } = useFormContext<CreateOrUpdate>()

  return (
    <FormField
      control={control}
      name="api_key"
      rules={placeholder ? undefined : { required: 'This field is required' }}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1">
          <FormLabel>API Key</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value || ''}
              type="password"
              placeholder={placeholder || 'sk-...'}
            />
          </FormControl>
          {placeholder && (
            <FormDescription>
              Leave blank to keep the current key.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export const FieldEnabled = () => {
  const { control } = useFormContext<CreateOrUpdate>()

  return (
    <FormField
      control={control}
      name="is_enabled"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between">
          <FormLabel>Enabled</FormLabel>
          <FormControl>
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  )
}
