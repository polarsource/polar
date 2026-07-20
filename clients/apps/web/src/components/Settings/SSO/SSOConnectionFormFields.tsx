'use client'

import { toast } from '@/components/Toast/use-toast'
import { getSSOJwksURL } from '@/utils/auth'
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import type { Control } from 'react-hook-form'
import SSOAuthorizationParamsFields from './SSOAuthorizationParamsFields'
import {
  SSO_PROVIDER_PRESETS,
  SSOConnectionFormValues,
  SSOProviderPreset,
} from './SSOConnectionForm'

export const CopyField = ({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) => (
  <Box flexDirection="column" gap="xs">
    <Text variant="label">{label}</Text>
    <CopyToClipboardInput
      value={value}
      variant="mono"
      onCopy={() => toast({ title: 'Copied to clipboard' })}
    />
    <Text variant="caption" color="muted">
      {hint}
    </Text>
  </Box>
)

const SSOConnectionFormFields = ({
  control,
  authMethod,
  callbackURL,
  secretRequired,
  preset,
  onPresetChange,
}: {
  control: Control<SSOConnectionFormValues>
  authMethod: SSOConnectionFormValues['auth_method']
  callbackURL: string
  secretRequired: boolean
  preset: SSOProviderPreset
  onPresetChange?: (preset: SSOProviderPreset) => void
}) => (
  <>
    {onPresetChange && (
      <Box flexDirection="column" gap="xs">
        <Text variant="label">Identity provider</Text>
        <Select
          onValueChange={(value) => onPresetChange(value as SSOProviderPreset)}
          value={preset}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SSO_PROVIDER_PRESETS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Box>
    )}
    <CopyField
      label="Callback URL"
      value={callbackURL}
      hint="Register this redirect URI with your identity provider."
    />
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1">
          <FormLabel>Name</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value || ''}
              placeholder="Acme SSO (optional)"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={control}
      name="issuer"
      rules={{ required: 'This field is required' }}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1">
          <FormLabel>Issuer URL</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value || ''}
              placeholder="https://idp.example.com"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={control}
      name="client_id"
      rules={{ required: 'This field is required' }}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1">
          <FormLabel>Client ID</FormLabel>
          <FormControl>
            <Input {...field} value={field.value || ''} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    {/* Google only advertises client_secret, so the choice is the preset's. A
        legacy connection stored with another method keeps the select. */}
    {!(preset === 'google' && authMethod === 'client_secret') && (
      <FormField
        control={control}
        name="auth_method"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1">
            <FormLabel>Authentication method</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_secret">Client secret</SelectItem>
                  <SelectItem value="private_key_jwt">
                    Private key JWT
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    )}
    {authMethod === 'private_key_jwt' ? (
      <CopyField
        label="JWKS URL"
        value={getSSOJwksURL()}
        hint="Configure your identity provider to fetch Polar's public keys from this URL."
      />
    ) : (
      <FormField
        control={control}
        name="client_secret"
        rules={
          secretRequired ? { required: 'This field is required' } : undefined
        }
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1">
            <FormLabel>Client secret</FormLabel>
            <FormControl>
              <Input {...field} value={field.value || ''} type="password" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    )}
    <SSOAuthorizationParamsFields preset={preset} />
  </>
)

export default SSOConnectionFormFields
