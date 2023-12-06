'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Section, SectionDescription } from '@/components/Settings/Section'
import Spinner from '@/components/Shared/Spinner'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { CreditBalance, Organization } from '@polar-sh/sdk'
import { api } from 'polarkit/api'
import {
  Button,
  Input,
  MoneyInput,
  ShadowBox,
} from 'polarkit/components/ui/atoms'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useOrganizationCredits, useUpdateOrganization } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import { useCallback, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  const credits = useOrganizationCredits(org?.id)

  if (!isLoaded || !org) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody>
      <div className="dark:divide-polar-700 divide-y divide-gray-200">
        <Section>
          <SectionDescription
            title="Payment"
            description="Manage organization invoicing, spending limits and payment methods"
          />
          <PaymentMethodSettings org={org} credits={credits.data} />
        </Section>
      </div>
    </DashboardBody>
  )
}

interface OrganizationSettingsForm {
  billing_email: string
  total_monthly_spending_limit: number
  per_user_monthly_spending_limit: number
}

const PaymentMethodSettings = ({
  org,
  credits,
}: {
  org: Organization
  credits?: CreditBalance
}) => {
  const [stripePortalLoading, setStripePortalLoading] = useState(false)

  const onGotoStripeCustomerPortal = async () => {
    setStripePortalLoading(true)

    const portal = await api.organizations.createStripeCustomerPortal({
      id: org.id,
    })
    if (portal) {
      window.location.href = portal.url
    }

    setStripePortalLoading(false)
  }

  const updateOrganization = useUpdateOrganization()

  const form = useForm<OrganizationSettingsForm>({
    defaultValues: {
      billing_email: org.billing_email,
      total_monthly_spending_limit: org.total_monthly_spending_limit,
      per_user_monthly_spending_limit: org.per_user_monthly_spending_limit,
    },
  })

  const { handleSubmit } = form

  const [didSave, setDidSave] = useState(false)

  const onSubmit = useCallback(
    async (organizationSettings: OrganizationSettingsForm) => {
      await updateOrganization.mutateAsync({
        id: org.id,
        settings: {
          set_per_user_monthly_spending_limit: true,
          set_total_monthly_spending_limit: true,
          ...organizationSettings,
        },
      })
      setDidSave(true)
    },
    [org, updateOrganization],
  )

  return (
    <ShadowBox>
      <>
        {credits && credits.amount.amount < 0 ? (
          <div className="dark:text-polar-500 space-y-2 p-4 text-sm text-gray-500">
            {org.name} has $
            {getCentsInDollarString(credits.amount.amount * -1, true, true)} in
            prepaid credits that will automatically be applied on future
            invoices.
          </div>
        ) : null}
        <div className="dark:text-polar-500 space-y-2 p-4 text-sm text-gray-500">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <BillingEmail />
              <TotalMonthlySpendingLimit />
              <PerUserMonthlySpendingLimit />

              <div className="flex flex-row items-center gap-x-4">
                <div className="flex items-center gap-2">
                  <Button type="submit" variant="default" disabled={didSave}>
                    Save
                  </Button>
                </div>

                <Button
                  fullWidth={false}
                  variant="secondary"
                  loading={stripePortalLoading}
                  onClick={onGotoStripeCustomerPortal}
                >
                  <ArrowTopRightOnSquareIcon className="mr-2 h-4 w-4" />
                  <span>Invoice settings and receipts</span>
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </>
    </ShadowBox>
  )
}

const BillingEmail = () => {
  const { control } = useFormContext<OrganizationSettingsForm>()

  return (
    <>
      <FormField
        control={control}
        name="billing_email"
        rules={{
          required: 'This field is required',
          minLength: 3,
          maxLength: 64,
          pattern: {
            value: /\S+@\S+\.\S+/,
            message: 'Entered value does not match email format',
          },
        }}
        defaultValue="finance@example.com"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-y-2">
              <FormLabel className="dark:text-polar-50 text-gray-950">
                Billing email
              </FormLabel>
              <p className="text-sm">
                An email where invoices should be sent to
              </p>
              <FormMessage />
            </div>
            <FormControl>
              <div className="w-[260px]">
                <Input placeholder="Email" {...field} type="email" />
              </div>
            </FormControl>
          </FormItem>
        )}
      />
    </>
  )
}

const TotalMonthlySpendingLimit = () => {
  const { control } = useFormContext<OrganizationSettingsForm>()

  return (
    <>
      <FormField
        control={control}
        name="total_monthly_spending_limit"
        rules={{
          required: 'This field is required',
          min: 0,
          max: 99999999,
        }}
        render={({ field }) => {
          return (
            <FormItem className="flex flex-row items-center justify-between">
              <div className="flex flex-col gap-y-2">
                <FormLabel className="dark:text-polar-50 text-gray-950">
                  Spending Limit
                </FormLabel>
                <p className="text-sm">An optional monthly limit for funds</p>
                <FormMessage />
              </div>
              <FormControl>
                <div className="w-[160px]">
                  <MoneyInput
                    id={field.name}
                    name={field.name}
                    placeholder={0}
                    value={field.value}
                    onAmountChangeInCents={(v) => field.onChange(v)}
                  />
                </div>
              </FormControl>
            </FormItem>
          )
        }}
      />
    </>
  )
}

const PerUserMonthlySpendingLimit = () => {
  const { control } = useFormContext<OrganizationSettingsForm>()

  return (
    <>
      <FormField
        control={control}
        name="per_user_monthly_spending_limit"
        rules={{
          required: 'This field is required',
          min: 0,
          max: 99999999,
          validate: (value, form) => {
            if (value > form.total_monthly_spending_limit) {
              return 'The per user spending limit can not be higher than the total limit.'
            }
            return true
          },
        }}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-y-2">
              <FormLabel className="dark:text-polar-50 text-gray-950">
                Member Spending Limit
              </FormLabel>
              <p className="text-sm">
                An optional monthly limit for each member
              </p>
              <FormMessage />
            </div>
            <FormControl>
              <div className="w-[160px]">
                <MoneyInput
                  id={field.name}
                  name={field.name}
                  placeholder={0}
                  value={field.value}
                  onAmountChangeInCents={(v) => field.onChange(v)}
                />
              </div>
            </FormControl>
          </FormItem>
        )}
      />
    </>
  )
}
