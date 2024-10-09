'use client'

import {
  CheckOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
} from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { Form } from 'polarkit/components/ui/form'
import React, { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ProductBenefitsForm from '../ProductBenefitsForm'
import { ProductInfoSection } from '../ProductForm/ProductInfoSection'
import { ProductMediaSection } from '../ProductForm/ProductMediaSection'
import { ProductPricingSection } from '../ProductForm/ProductPricingSection'
import { ProductWizardPanel } from './ProductWizardPanel'
import { useCreateProductWizard } from './useCreateProductWizard'

export interface JourneyProps {
  steps: {
    id: string
    children: React.ReactElement
  }[]
}

export const Journey = ({ steps }: JourneyProps) => {
  const [currentStep, setCurrentStep] = useState(0)

  const step = useMemo(() => steps[currentStep], [currentStep, steps])
  const nextStep = useMemo(() => steps[currentStep + 1], [currentStep, steps])
  const previousStep = useMemo(
    () => steps[currentStep - 1],
    [currentStep, steps],
  )

  return (
    <>
      <div className="flex h-full w-full flex-grow flex-col">
        {step && (
          <ShadowBox className="bg-transparent p-12 dark:bg-transparent">
            {step.children}
          </ShadowBox>
        )}
      </div>
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-x-8">
          <button
            className={twMerge(
              'dark:bg-polar-700 dark:hover:bg-polar-600 flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-gray-200 text-gray-500 transition-colors hover:bg-gray-100 dark:text-white',
              previousStep ? '' : 'opacity-30',
            )}
            onClick={() => setCurrentStep(currentStep - 1)}
            disabled={!previousStep}
            type="button"
          >
            <ChevronLeftOutlined />
          </button>

          <span className="dark:text-polar-500 text-sm text-gray-500">
            {currentStep + 1} / {steps.length}
          </span>

          {nextStep ? (
            <button
              key={step.id}
              className={twMerge(
                'dark:bg-polar-700 dark:hover:bg-polar-600 flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-gray-200 text-gray-500 transition-colors hover:bg-gray-100 dark:text-white',
              )}
              type="button"
              onClick={() => {
                setCurrentStep(currentStep + 1)
              }}
            >
              <ChevronRightOutlined />
            </button>
          ) : (
            <button
              key={step.id}
              className={twMerge(
                'flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-blue-500 text-white transition-colors hover:bg-blue-400',
              )}
              type="submit"
            >
              <CheckOutlined fontSize="small" />
            </button>
          )}
        </div>
        <div className="flex flex-row items-center gap-x-3">
          {[
            steps.map((step, index) => (
              <div
                key={step.id}
                className={twMerge(
                  'dark:bg-polar-600 h-3 w-3 rounded-full bg-gray-200',
                  currentStep >= index ? 'bg-blue-500 dark:bg-blue-500' : '',
                )}
              />
            )),
          ]}
        </div>
      </div>
    </>
  )
}

export interface ProductWizardProps {
  organization: Organization
}

export const ProductWizard = ({ organization }: ProductWizardProps) => {
  const {
    form,
    handleSubmit,
    onSubmit,
    organizationBenefits,
    enabledBenefits,
    onRemoveBenefit,
    onSelectBenefit,
  } = useCreateProductWizard(organization)

  return (
    <ProductWizardPanel className="min-h-[720px] w-full gap-y-12">
      <h3 className="self-start text-2xl font-medium">Create Product</h3>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex h-full w-full flex-col gap-y-12"
        >
          <Journey
            steps={[
              {
                id: 'product-info',
                children: <ProductInfoSection className="md:py-0" />,
              },
              {
                id: 'product-pricing',
                children: (
                  <ProductPricingSection className="md:py-0" update={false} />
                ),
              },
              {
                id: 'product-medias',
                children: (
                  <ProductMediaSection
                    className="md:py-0"
                    organization={organization}
                  />
                ),
              },
              {
                id: 'product-benefits',
                children: (
                  <ProductBenefitsForm
                    className="md:py-0"
                    organization={organization}
                    organizationBenefits={organizationBenefits.filter(
                      (benefit) =>
                        // Hide not selectable benefits unless they are already enabled
                        benefit.selectable ||
                        enabledBenefits.some((b) => b.id === benefit.id),
                    )}
                    benefits={enabledBenefits}
                    onSelectBenefit={onSelectBenefit}
                    onRemoveBenefit={onRemoveBenefit}
                  />
                ),
              },
            ]}
          />
        </form>
      </Form>
    </ProductWizardPanel>
  )
}
