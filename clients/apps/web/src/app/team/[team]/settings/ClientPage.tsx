'use client'

import { Section, SectionDescription } from '@/components/Settings/Section'
import Spinner from '@/components/Shared/Spinner'
import { useCurrentTeamFromURL } from '@/hooks/org'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { CreditBalance, Organization } from '@polar-sh/sdk'
import { api } from 'polarkit/api'
import { Input, MoneyInput, PrimaryButton } from 'polarkit/components/ui/atoms'
import { Button } from 'polarkit/components/ui/button'
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
  const { org, isLoaded } = useCurrentTeamFromURL()

  const credits = useOrganizationCredits(org?.id)

  if (!isLoaded || !org) {
    return <Spinner />
  }

  return (
    <>
      <div>
        <h2 className="text-2xl font-medium">Team settings</h2>
      </div>

      <div className="dark:divide-polar-700 divide-y divide-gray-200">
        <Section>
          <SectionDescription title="Payment methods" />
          <PaymentMethodSettings org={org} credits={credits.data} />
        </Section>
      </div>
    </>
  )
}

interface TeamSettingsForm {
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

  const form = useForm<TeamSettingsForm>({
    defaultValues: {
      billing_email: org.billing_email,
      total_monthly_spending_limit: org.total_monthly_spending_limit,
      per_user_monthly_spending_limit: org.per_user_monthly_spending_limit,
    },
  })

  const { handleSubmit } = form

  const [showDidSave, setShowDidSave] = useState(false)

  const onSubmit = useCallback(
    async (teamSettings: TeamSettingsForm) => {
      await updateOrganization.mutateAsync({
        id: org.id,
        settings: {
          set_per_user_monthly_spending_limit: true,
          set_total_monthly_spending_limit: true,
          ...teamSettings,
        },
      })
      setShowDidSave(true)

      setTimeout(() => {
        setShowDidSave(false)
      }, 4000)
    },
    [org, updateOrganization],
  )

  return (
    <div className="dark:text-polar-200 dark:border-polar-700 dark:bg-polar-800 flex w-full flex-col divide-y rounded-xl border text-gray-900">
      {credits && credits.amount.amount < 0 ? (
        <div className="dark:text-polar:300 space-y-2 p-4 text-sm text-gray-500">
          {org.name} has $
          {getCentsInDollarString(credits.amount.amount * -1, true, true)} in
          prepaid credits that will automatically be applied on future invoices.
        </div>
      ) : null}
      <div className="dark:text-polar:300 space-y-2 p-4 text-sm text-gray-500">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <BillingEmail />
            <TotalMonthlySpendingLimit />
            <PerUserMonthlySpendingLimit />

            <div className="flex items-center gap-2">
              <Button type="submit" variant="default">
                Save
              </Button>

              {showDidSave && <div>Saved!</div>}
            </div>
          </form>
        </Form>
      </div>

      <div className="dark:text-polar:300 space-y-2 p-4 text-sm text-gray-500">
        <PrimaryButton
          fullWidth={false}
          classNames=""
          loading={stripePortalLoading}
          onClick={onGotoStripeCustomerPortal}
        >
          <ArrowTopRightOnSquareIcon className="mr-2 h-5 w-5" />
          <span>Invoice settings and receipts</span>
        </PrimaryButton>
      </div>
    </div>
  )
}

const BillingEmail = () => {
  const { control } = useFormContext<TeamSettingsForm>()

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
          <FormItem className="max-w-[300px]">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Billing email</FormLabel>
            </div>
            <FormControl>
              <Input {...field} type="email" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}

const TotalMonthlySpendingLimit = () => {
  const { control } = useFormContext<TeamSettingsForm>()

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
            <FormItem className="max-w-[300px]">
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Total Monthly Spending Limit</FormLabel>
              </div>
              <FormControl>
                <MoneyInput
                  id={field.name}
                  name={field.name}
                  placeholder={0}
                  value={field.value}
                  onAmountChangeInCents={(v) => field.onChange(v)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </>
  )
}

const PerUserMonthlySpendingLimit = () => {
  const { control } = useFormContext<TeamSettingsForm>()

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
          <FormItem className="max-w-[300px]">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Per User Spending Limit</FormLabel>
            </div>
            <FormControl>
              <MoneyInput
                id={field.name}
                name={field.name}
                placeholder={0}
                value={field.value}
                onAmountChangeInCents={(v) => field.onChange(v)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
