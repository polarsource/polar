import { useUpdateOrganization } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { setValidationErrors } from '@/utils/api/errors'
import { ErrorMessage } from '@hookform/error-message'
import {
  OrganizationUpdate,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import { Switch } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import TextArea from 'polarkit/components/ui/atoms/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import {
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { useCustomizationContext } from './CustomizationProvider'
import Link from 'next/link'

const SidebarContentWrapper = ({
  title,
  enabled,
  onEnabledChange,
  children,
}: PropsWithChildren<{
  title: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}>) => {
  return (
    <div className="flex h-full flex-col gap-y-8">
      <div className="flex flex-row items-center justify-between">
        <h2 className="text-lg">{title}</h2>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled ? (
        <div className={twMerge('flex flex-col gap-y-8')}>{children}</div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-y-2 text-center">
          <h3 className="font-medium">{title} is disabled</h3>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Press the switch in the upper right corner to enable & customize it
          </p>
        </div>
      )}
    </div>
  )
}

const PublicPageForm = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<OrganizationUpdate>()

  return (
    <>
      <FormField
        control={control}
        name="profile_settings.description"
        rules={{
          maxLength: 160,
        }}
        defaultValue=""
        render={({ field }) => (
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Description</FormLabel>
              <span className="dark:text-polar-400 text-sm text-gray-400">
                {field.value?.length ?? 0} / 160
              </span>
            </div>
            <FormControl>
              <TextArea
                {...field}
                value={field.value || ''}
                resizable={false}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <ErrorMessage
        errors={errors}
        name="prices"
        render={({ message }) => (
          <p className="text-destructive text-sm">{message}</p>
        )}
      />
    </>
  )
}

const PublicPageCustomizationContent = () => {
  const { organization } = useContext(MaintainerOrganizationContext)

  const [isLoading, setLoading] = useState(false)

  const form = useForm<OrganizationUpdate>({
    defaultValues: {
      ...organization,
    },
  })
  const { handleSubmit, setError, formState } = form
  // const updatedOrganization = watch()

  const updateOrganization = useUpdateOrganization()

  const onSubmit = useCallback(
    async (organizationUpdate: OrganizationUpdate) => {
      try {
        setLoading(true)
        await updateOrganization.mutateAsync({
          id: organization.id,
          body: organizationUpdate,
        })
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          }
        }
      } finally {
        setLoading(false)
      }
    },
    [organization, setError],
  )

  const toggleProfilePage = useCallback(
    async (enabled: boolean) => {
      await updateOrganization.mutateAsync({
        id: organization.id,
        body: {
          profile_settings: {
            enabled,
          },
        },
      })
    },
    [organization],
  )

  return (
    <SidebarContentWrapper
      title="Public Page"
      enabled={organization.profile_settings?.enabled ?? false}
      onEnabledChange={toggleProfilePage}
    >
      <div className="flex flex-row items-center gap-x-4">
        <Avatar
          className="h-12 w-12"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />
        <div className="flex flex-col gap-y-1">
          <h3>{organization.name}</h3>
          <Link className="dark:text-blue-400 text-xs text-blue-500" href={`/${organization.slug}`} target='_blank'>
            View Public Page
          </Link>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6"
        >
          <PublicPageForm />
          <Button
            className="self-start"
            type="submit"
            loading={isLoading}
            disabled={!formState.isDirty}
          >
            Save
          </Button>
        </form>
      </Form>
    </SidebarContentWrapper>
  )
}

const CheckoutCustomizationContent = () => {
  const { organization } = useContext(MaintainerOrganizationContext)
  const [enabled, setEnabled] = useState(false)

  return (
    <SidebarContentWrapper
      title="Checkout"
      enabled={enabled}
      onEnabledChange={setEnabled}
    >
      <Input placeholder="Organization Name" value={organization.name} />
    </SidebarContentWrapper>
  )
}

const ReceiptCustomizationContent = () => {
  const { organization } = useContext(MaintainerOrganizationContext)
  const [enabled, setEnabled] = useState(false)

  return (
    <SidebarContentWrapper
      title="Receipt"
      enabled={enabled}
      onEnabledChange={setEnabled}
    >
      <Input placeholder="Organization Name" value={organization.name} />
    </SidebarContentWrapper>
  )
}

export const CustomizationSidebar = () => {
  const { customizationMode } = useCustomizationContext()

  const content = useMemo(() => {
    switch (customizationMode) {
      case 'public_page':
        return <PublicPageCustomizationContent />
      case 'checkout':
        return <CheckoutCustomizationContent />
      case 'receipt':
        return <ReceiptCustomizationContent />
    }
  }, [customizationMode])

  return (
    <ShadowBox className="flex w-full max-w-96 flex-shrink-0 flex-col p-10">
      {content}
    </ShadowBox>
  )
}
