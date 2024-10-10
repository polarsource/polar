'use client'

import {
  CheckOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
} from '@mui/icons-material'
import { Organization, Product } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { Form } from 'polarkit/components/ui/form'
import { Separator } from 'polarkit/components/ui/separator'
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
      <div className="flex flex-row items-center justify-between">
        <h3 className="self-start text-2xl font-medium">Create Product</h3>
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
      <Separator />
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
      <div className="flex flex-row items-center justify-end">
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
            <Button key={step.id} type="submit" loading={loading}>
              Create Product
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

export interface ProductWizardProps {
  organization: Organization
  completed?: boolean
  onSuccess?: (product: Product) => void
}

export const ProductWizard = ({
  organization,
  onSuccess,
  completed,
}: ProductWizardProps) => {
  const {
    form,
    handleSubmit,
    onSubmit,
    isLoading,
    organizationBenefits,
    enabledBenefits,
    onRemoveBenefit,
    onSelectBenefit,
  } = useCreateProductWizard(organization, onSuccess)

  return (
    <ShadowBox
      className={twMerge(
        'flex w-full flex-col p-12',
        completed ? '' : 'min-h-[720px]',
      )}
    >
      {completed ? (
        <div className="flex flex-row items-center justify-between gap-x-8">
          <h3 className="text-xl font-medium">Create Product</h3>
          <div className="flex h-10 w-10 flex-col items-center justify-center rounded-full bg-blue-500">
            <CheckOutlined fontSize="medium" />
          </div>
        </div>
      ) : (
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
      )}
    </ShadowBox>
  )
}
