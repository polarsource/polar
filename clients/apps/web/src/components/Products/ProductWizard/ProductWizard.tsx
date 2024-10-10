'use client'

import {
  CheckOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
} from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { Form } from 'polarkit/components/ui/form'
import React, { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ProductBenefitsForm from '../ProductBenefitsForm'
import { ProductInfoSection } from '../ProductForm/ProductInfoSection'
import { ProductMediaSection } from '../ProductForm/ProductMediaSection'
import { ProductPricingSection } from '../ProductForm/ProductPricingSection'
import { useCreateProductWizard } from './useCreateProductWizard'

export interface JourneyProps {
  steps: {
    id: string
    children: React.ReactElement
  }[]
  loading?: boolean
}

export const Journey = ({ steps, loading }: JourneyProps) => {
  const [currentStep, setCurrentStep] = useState(0)

  const step = useMemo(() => steps[currentStep], [currentStep, steps])
  const nextStep = useMemo(() => steps[currentStep + 1], [currentStep, steps])
  const previousStep = useMemo(
    () => steps[currentStep - 1],
    [currentStep, steps],
  )

  return (
    <>
      <div className="relative flex h-full w-full flex-grow flex-col">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={twMerge(
              'h-full w-full flex-col gap-y-12',
              currentStep === index ? 'flex' : 'hidden',
            )}
          >
            {step.children}
          </div>
        ))}
      </div>
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-x-6">
          <Button
            onClick={() => setCurrentStep(currentStep - 1)}
            className="h-10 w-10"
            disabled={!previousStep}
            type="button"
            variant="secondary"
            size="icon"
          >
            <ChevronLeftOutlined />
          </Button>

          <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
            {currentStep + 1} / {steps.length}
          </span>

          {nextStep ? (
            <Button
              key={step.id}
              className="h-10 w-10"
              variant="secondary"
              type="button"
              size="icon"
              onClick={() => {
                setCurrentStep(currentStep + 1)
              }}
            >
              <ChevronRightOutlined />
            </Button>
          ) : (
            <Button
              key={step.id}
              className="h-10 w-10"
              type="submit"
              size="icon"
              loading={loading}
            >
              <CheckOutlined fontSize="small" />
            </Button>
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
    isLoading,
    organizationBenefits,
    enabledBenefits,
    onRemoveBenefit,
    onSelectBenefit,
  } = useCreateProductWizard(organization)

  return (
    <ShadowBox className="flex min-h-[720px] w-full flex-col gap-y-24 p-12">
      <h3 className="self-start text-2xl font-medium">Create Product</h3>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex h-full w-full flex-col gap-y-12"
        >
          <Journey
            loading={isLoading}
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
    </ShadowBox>
  )
}
