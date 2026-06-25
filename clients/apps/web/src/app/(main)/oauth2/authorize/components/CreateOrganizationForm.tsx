'use client'

import revalidate from '@/app/actions'
import { CurrencySelector } from '@/components/CurrencySelector'
import { useAuth } from '@/hooks'
import { useCreateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button, Checkbox, Input } from '@polar-sh/orbit'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Label } from '@polar-sh/ui/components/ui/label'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useState,
} from 'react'
import { useForm, useWatch } from 'react-hook-form'
import slugify from 'slugify'
import SupportedUseCases from './SupportedUseCases'

type FormSchema = Pick<
  schemas['OrganizationCreate'],
  'name' | 'slug' | 'default_presentment_currency' | 'default_tax_behavior'
> & {
  terms: boolean
}

// Lifted from the old OrganizationSelectionPage so org creation stays reachable
// from the OAuth flow. Lives inside the consent <form>, so it never renders a
// nested form — the submit button drives the mutation directly.
const CreateOrganizationForm = ({
  onCreated,
}: {
  onCreated: (organization: schemas['Organization']) => void
}) => {
  const { currentUser, setUserOrganizations } = useAuth()
  const createOrganization = useCreateOrganization()
  const [editedSlug, setEditedSlug] = useState(false)

  const form = useForm<FormSchema>({
    defaultValues: {
      name: '',
      slug: '',
      default_presentment_currency: 'usd',
      terms: false,
    },
  })

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = form

  const { name, slug, terms } = useWatch({ control })

  useEffect(() => {
    if (!editedSlug && name) {
      setValue('slug', slugify(name, { lower: true, strict: true }))
    } else if (slug) {
      setValue(
        'slug',
        slugify(slug, { lower: true, trim: false, strict: true }),
      )
    }
  }, [name, editedSlug, slug, setValue])

  const onSubmit = async (data: FormSchema) => {
    if (!data.terms) return

    const { data: organization, error } =
      await createOrganization.mutateAsync(data)

    if (error) {
      if (error.detail) {
        setValidationErrors(error.detail, setError)
      }
      return
    }

    await revalidate(`users:${currentUser?.id}:organizations`, { expire: 0 })
    setUserOrganizations((orgs) => [
      ...orgs,
      { ...organization, role: 'owner' as const },
    ])
    onCreated(organization)
  }

  // The inputs live inside the OAuth consent <form>; without this, Enter would
  // submit it (Allow) instead of staying on the create step.
  const blockEnterSubmit = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
    }
  }

  return (
    <Form {...form}>
      <div className="flex flex-col gap-y-4">
        <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-white p-6">
          <FormField
            control={control}
            name="name"
            rules={{
              required: 'Organization name is required',
              minLength: {
                value: 3,
                message: 'Name must be at least 3 characters',
              },
            }}
            render={({ field }) => (
              <FormItem className="w-full">
                <Label htmlFor="name">Organization Name</Label>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Acme Inc."
                    onKeyDown={blockEnterSubmit}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="slug"
            rules={{
              required: 'Slug is required',
              minLength: {
                value: 3,
                message: 'Slug must be at least 3 characters',
              },
            }}
            render={({ field }) => (
              <FormItem className="w-full">
                <Label htmlFor="slug">Organization Slug</Label>
                <FormControl>
                  <Input
                    type="text"
                    {...field}
                    placeholder="acme-inc"
                    onFocus={() => setEditedSlug(true)}
                    onKeyDown={blockEnterSubmit}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="default_presentment_currency"
            rules={{ required: 'Currency is required' }}
            render={({ field }) => (
              <FormItem className="w-full">
                <Label htmlFor="default_presentment_currency">
                  Default payment currency
                </Label>
                <FormControl>
                  <CurrencySelector
                    value={field.value as schemas['PresentmentCurrency']}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  The default currency for your products
                </FormDescription>
              </FormItem>
            )}
          />
        </div>

        <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-white p-6">
          <SupportedUseCases />
        </div>

        <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col rounded-2xl border border-gray-200 bg-white p-6">
          <FormField
            control={control}
            name="terms"
            rules={{ required: 'You must accept the terms to continue' }}
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-row items-start gap-x-3">
                  <Checkbox
                    id="terms"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      setValue('terms', checked === true)
                    }}
                    className="mt-1"
                  />
                  <div className="flex flex-col gap-y-2 text-sm">
                    <label
                      htmlFor="terms"
                      className="cursor-pointer leading-relaxed font-medium"
                    >
                      I understand the restrictions above and agree to
                      Polar&rsquo;s terms
                    </label>
                    <ul className="dark:text-polar-400 flex flex-col gap-y-1 text-sm text-gray-500">
                      <li>
                        <a
                          href="https://polar.sh/docs/merchant-of-record/account-reviews"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Account Reviews Policy
                        </a>
                        {' - '}I&apos;ll comply with KYC/AML requirements
                        including website and social verification
                      </li>
                      <li>
                        <a
                          href="https://polar.sh/legal/master-services-terms"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Terms of Service
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://polar.sh/legal/privacy-policy"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Privacy Policy
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {errors.root && (
          <p className="text-destructive-foreground text-sm">
            {errors.root.message}
          </p>
        )}

        <Button
          type="button"
          loading={createOrganization.isPending}
          disabled={
            !name || !slug || name.length < 3 || slug.length < 3 || !terms
          }
          onClick={handleSubmit(onSubmit)}
        >
          Create Organization
        </Button>
      </div>
    </Form>
  )
}

export default CreateOrganizationForm
