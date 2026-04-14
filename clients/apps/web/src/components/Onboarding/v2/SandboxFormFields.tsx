'use client'

import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useEffect } from 'react'
import { type UseFormReturn, useFormContext, useWatch } from 'react-hook-form'
import slugify from 'slugify'
import { CurrencySelector } from '../../CurrencySelector'
import { useOnboardingData } from './OnboardingContext'

interface FormSchema {
  orgName: string
  orgSlug: string
  defaultCurrency: string
  terms: boolean
}

export function OrgNameSlugSync({ editedSlug }: { editedSlug: boolean }) {
  const { setValue } = useFormContext<FormSchema>()
  const { updateData } = useOnboardingData()
  const orgName = useWatch<FormSchema, 'orgName'>({ name: 'orgName' })
  const orgSlug = useWatch<FormSchema, 'orgSlug'>({ name: 'orgSlug' })
  const defaultCurrency = useWatch<FormSchema, 'defaultCurrency'>({
    name: 'defaultCurrency',
  })

  useEffect(() => {
    if (!editedSlug && orgName) {
      setValue('orgSlug', slugify(orgName, { lower: true, strict: true }))
    }
  }, [orgName, editedSlug, setValue])

  useEffect(() => {
    updateData({ orgName, orgSlug, defaultCurrency })
  }, [orgName, orgSlug, defaultCurrency, updateData])

  return null
}

function SlugPreview({
  editingSlug,
  setEditingSlug,
  onEditSlug,
}: {
  editingSlug: boolean
  setEditingSlug: (v: boolean) => void
  onEditSlug: () => void
}) {
  const { setValue } = useFormContext<FormSchema>()
  const orgSlug = useWatch<FormSchema, 'orgSlug'>({ name: 'orgSlug' })

  return (
    <Box
      as="span"
      display="flex"
      alignItems="center"
      gap="xs"
      color="text-tertiary"
    >
      <Box as="span">polar.sh/</Box>
      {editingSlug ? (
        <input
          value={orgSlug}
          onChange={(e) => {
            setValue(
              'orgSlug',
              slugify(e.target.value, {
                lower: true,
                trim: false,
                strict: true,
              }),
            )
            onEditSlug()
          }}
          onBlur={() => setEditingSlug(false)}
          className="dark:text-polar-300 rounded border-none bg-transparent p-0 text-xs text-gray-600 outline-none"
          style={{ width: `${Math.max(orgSlug.length, 8)}ch` }}
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingSlug(true)}
          className="dark:text-polar-300 dark:hover:text-polar-200 text-gray-600 underline decoration-dotted hover:text-gray-800"
        >
          {orgSlug || 'your-slug'}
        </button>
      )}
    </Box>
  )
}

export function SandboxFormFields({
  editingSlug,
  setEditingSlug,
  onEditSlug,
  form,
}: {
  editingSlug: boolean
  setEditingSlug: (v: boolean) => void
  onEditSlug: () => void
  form: UseFormReturn<FormSchema>
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="orgName"
        rules={{ required: 'Organization name is required' }}
        render={({ field }) => (
          <FormItem className="w-full">
            <FormLabel>Organization Name</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Acme Inc." />
            </FormControl>
            <FormMessage />
            <SlugPreview
              editingSlug={editingSlug}
              setEditingSlug={setEditingSlug}
              onEditSlug={onEditSlug}
            />
          </FormItem>
        )}
      />
      <FormField
        name="defaultCurrency"
        rules={{ required: 'Currency is required' }}
        render={({ field }) => (
          <FormItem className="w-full">
            <FormLabel>Default Payment Currency</FormLabel>
            <FormControl>
              <CurrencySelector
                value={field.value as schemas['PresentmentCurrency']}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="terms"
        rules={{ required: 'You must accept the terms to continue' }}
        render={({ field }) => (
          <FormItem>
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
                  form.setValue('terms', checked ? true : false)
                }}
                className="mt-0.5"
              />
              <Box as="label" htmlFor="terms">
                <p className="cursor-pointer text-sm leading-snug font-medium">
                  I agree to Polar&apos;s{' '}
                  <a
                    href="https://polar.sh/legal/terms"
                    className="text-gray-900 underline dark:text-white"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Terms
                  </a>
                  ,{' '}
                  <a
                    href="https://polar.sh/legal/privacy"
                    className="text-gray-900 underline dark:text-white"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Privacy Policy
                  </a>{' '}
                  &amp;{' '}
                  <a
                    href="https://polar.sh/docs/merchant-of-record/account-reviews"
                    className="text-gray-900 underline dark:text-white"
                    target="_blank"
                    rel="noreferrer"
                  >
                    AUP
                  </a>
                </p>
              </Box>
            </Box>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
