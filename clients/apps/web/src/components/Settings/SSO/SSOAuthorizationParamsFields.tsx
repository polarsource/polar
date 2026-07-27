'use client'

import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useEffect } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import {
  SSOConnectionFormValues,
  SSOProviderPreset,
  WORKSPACE_DOMAIN_PARAMETER,
} from './SSOConnectionForm'

const SSOAuthorizationParamsFields = ({
  preset,
}: {
  preset: SSOProviderPreset
}) => {
  const { control } = useFormContext<SSOConnectionFormValues>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'authorization_parameters',
  })

  // Under the Google preset, the `hd` entry is surfaced as a friendly Workspace
  // domain input. It's the same array entry, so the two views can't diverge.
  const workspaceDomainIndex = fields.findIndex(
    ({ key }) => key === WORKSPACE_DOMAIN_PARAMETER,
  )
  const showWorkspaceDomain = preset === 'google' && workspaceDomainIndex >= 0

  // The entry has to exist for the input to bind to, including on a connection
  // saved without one — an empty domain isn't persisted.
  useEffect(() => {
    if (preset === 'google' && workspaceDomainIndex < 0) {
      append(
        { key: WORKSPACE_DOMAIN_PARAMETER, value: '' },
        { shouldFocus: false },
      )
    } else if (preset !== 'google' && workspaceDomainIndex >= 0) {
      remove(workspaceDomainIndex)
    }
  }, [preset, workspaceDomainIndex, append, remove])

  return (
    <Box flexDirection="column" gap="l">
      {showWorkspaceDomain && (
        <FormField
          control={control}
          name={`authorization_parameters.${workspaceDomainIndex}.value`}
          render={({ field }) => (
            <FormItem className="flex flex-col gap-1">
              <FormLabel>Workspace domain</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ''}
                  placeholder="acme.com (optional)"
                />
              </FormControl>
              <Text variant="caption" color="muted">
                {field.value
                  ? `Appended to the sign-in URL as ?…&${WORKSPACE_DOMAIN_PARAMETER}=${field.value}`
                  : `Preselects accounts from this domain on Google's sign-in screen, via the ${WORKSPACE_DOMAIN_PARAMETER} parameter.`}
              </Text>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <Box flexDirection="column" gap="s">
        <Text variant="label">Additional authorization parameters</Text>
        {fields.map((entry, index) =>
          showWorkspaceDomain && index === workspaceDomainIndex ? null : (
            <Box key={entry.id} gap="s" alignItems="start">
              <FormField
                control={control}
                name={`authorization_parameters.${index}.key`}
                render={({ field }) => (
                  <FormItem className="flex flex-1 flex-col gap-1">
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="Parameter"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`authorization_parameters.${index}.value`}
                render={({ field }) => (
                  <FormItem className="flex flex-1 flex-col gap-1">
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="Value"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => remove(index)}
              >
                Remove
              </Button>
            </Box>
          ),
        )}
        <Box>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => append({ key: '', value: '' })}
          >
            Add parameter
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export default SSOAuthorizationParamsFields
