'use client'

import { Box } from '@polar-sh/orbit/Box'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Control, FieldValues, Path, PathValue } from 'react-hook-form'

interface TermsCheckboxProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  setValue: (name: Path<T>, value: PathValue<T, Path<T>>) => void
}

export function TermsCheckbox<T extends FieldValues>({
  control,
  name,
  setValue,
}: TermsCheckboxProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      rules={{ required: 'You must accept the terms to continue' }}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Box
              display="flex"
              flexDirection="row"
              alignItems="start"
              columnGap="m"
            >
              <Checkbox
                id="terms"
                checked={field.value}
                onCheckedChange={(checked) => {
                  setValue(
                    name,
                    (checked ? true : false) as PathValue<T, Path<T>>,
                  )
                }}
                className="mt-0.5"
              />
              <Box display="flex" flexDirection="column" rowGap="xs">
                <Box as="label" htmlFor="terms">
                  <p className="cursor-pointer text-sm leading-snug font-medium">
                    I agree to Polar&apos;s{' '}
                    <a
                      href="https://polar.sh/legal/master-services-terms"
                      className="text-gray-900 underline dark:text-white"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Terms
                    </a>
                    ,{' '}
                    <a
                      href="https://polar.sh/legal/privacy-policy"
                      className="text-gray-900 underline dark:text-white"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Privacy Policy
                    </a>{' '}
                    &amp;{' '}
                    <a
                      href="https://polar.sh/legal/acceptable-use-policy"
                      className="text-gray-900 underline dark:text-white"
                      target="_blank"
                      rel="noreferrer"
                    >
                      AUP
                    </a>
                  </p>
                </Box>
              </Box>
            </Box>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
