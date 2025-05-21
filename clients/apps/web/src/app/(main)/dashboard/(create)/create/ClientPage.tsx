'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import CheckoutComponent from '@/components/Checkout/Checkout'
import { DummyCheckoutContextProvider } from '@/components/Checkout/DummyCheckoutContextProvider'
import { createCheckoutPreview } from '@/components/Customization/utils'
import OrganizationStep from '@/components/Onboarding/OrganizationStep'
import ProductStep from '@/components/Onboarding/ProductStep'
import { schemas } from '@polar-sh/client'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const useOnboardingState = () => {
  const [organization, setOrganization] = useState<
    schemas['Organization'] | null
  >(null)

  const [product, setProduct] = useState<schemas['Product'] | null>(null)

  const [step, setStep] = useState<'organization' | 'product' | 'integration'>(
    'organization',
  )

  return {
    step,
    setStep,
    organization,
    setOrganization,
    product,
    setProduct,
  }
}

export default function ClientPage({
  slug: initialSlug,
  validationErrors,
  error,
}: {
  slug?: string
  validationErrors?: schemas['ValidationError'][]
  error?: string
}) {
  const { step, setStep, setOrganization, organization, product, setProduct } =
    useOnboardingState()

  const stepContent = useMemo(() => {
    switch (step) {
      case 'organization':
        return (
          <OrganizationStep
            slug={initialSlug}
            validationErrors={validationErrors}
            error={error}
            onCreate={(organization) => {
              setOrganization(organization)
              setStep('product')
            }}
          />
        )
      case 'product':
        return (
          <ProductStep
            organization={organization!}
            onCreate={(product) => {
              setProduct(product)
            }}
          />
        )
      case 'integration':
        // return <IntegrationStep />
        return null
    }
  }, [
    step,
    initialSlug,
    validationErrors,
    error,
    setOrganization,
    setStep,
    organization,
    setProduct,
  ])

  const stepIndex = useMemo(() => {
    switch (step) {
      case 'organization':
        return 0
      case 'product':
        return 1
      case 'integration':
        return 2
    }
  }, [step])

  return (
    <div className="flex h-full flex-col gap-12 lg:flex-row">
      <div className="flex h-full min-h-0 max-w-lg flex-col gap-12 overflow-y-auto p-12">
        <div className="flex flex-col gap-y-12">
          <LogoIcon size={50} />
          <div className="flex flex-col gap-y-4">
            <h1 className="text-3xl">Let&apos;s get you onboarded</h1>
            <p className="dark:text-polar-400 text-lg text-gray-600">
              Get up to speed with an Organization, Product & Checkout Session.
            </p>
          </div>
        </div>
        <div className="flex flex-row gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className={twMerge(
                'dark:bg-polar-700 flex h-2 flex-1 rounded-full bg-gray-300',
                index <= stepIndex && 'bg-black dark:bg-white',
              )}
            />
          ))}
        </div>
        {stepContent}
      </div>
      <div className="dark:bg-polar-900 rounded-4xl my-12 mr-12 flex flex-1 flex-grow flex-col items-center justify-center gap-12 p-12">
        <div className="flex max-w-4xl flex-col gap-12">
          {step === 'product' && (
            <DummyCheckoutContextProvider
              checkout={createCheckoutPreview(product!, organization!)}
            >
              <CheckoutComponent />
            </DummyCheckoutContextProvider>
          )}
        </div>
      </div>
    </div>
  )
}
