'use client'

import { Section } from '@/components/Layout/Section'
import { ErrorMessage } from '@hookform/error-message'
import {
  CheckOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
} from '@mui/icons-material'
import {
  Organization,
  ProductPriceType,
  SubscriptionRecurringInterval,
} from '@polar-sh/sdk'
import { motion } from 'framer-motion'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import TextArea from 'polarkit/components/ui/atoms/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { PropsWithChildren, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  ProductPriceCustomItem,
  ProductPriceFreeItem,
  ProductPriceItem,
} from '../ProductForm'
import ProductMediasField from '../ProductMediasField'
import { ProductWizardPanel } from './ProductWizardPanel'
import { useCreateProductWizard } from './useCreateProductWizard'

export interface JourneyProps {
  steps: JourneyStepProps[]
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
    <ProductWizardPanel className="min-h-[620px] w-full gap-y-16">
      <div className="flex flex-row items-center gap-x-4">
        {[
          steps.map((step, index) => (
            <div
              key={step.title}
              className={twMerge(
                'dark:bg-polar-600 h-3 w-3 rounded-full bg-gray-200',
                currentStep >= index ? 'bg-blue-500 dark:bg-blue-500' : '',
              )}
            />
          )),
        ]}
      </div>
      <motion.div
        className="flex h-full w-full flex-grow flex-col"
        variants={{
          initial: { opacity: 0 },
          animate: {
            opacity: 1,
            transition: { duration: 2, ease: [0.75, 0, 0.25, 1] },
          },
        }}
      >
        {step && <JourneyStep {...step} />}
      </motion.div>
      <div className="flex flex-row items-center gap-x-8">
        <motion.button
          className={twMerge(
            'dark:bg-polar-700 rounded-xl bg-gray-200 p-2 text-gray-500 dark:text-white',
            previousStep ? '' : 'opacity-30',
          )}
          onClick={() => setCurrentStep(currentStep - 1)}
          disabled={!previousStep}
          type="button"
        >
          <ChevronLeftOutlined />
        </motion.button>

        <span className="dark:text-polar-500 text-sm text-gray-500">
          {currentStep + 1} / {steps.length}
        </span>

        {nextStep ? (
          <motion.button
            className={twMerge(
              'dark:bg-polar-700 flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-gray-200 text-gray-500 dark:text-white',
            )}
            type="button"
            onClick={() => {
              setCurrentStep(currentStep + 1)
            }}
          >
            <ChevronRightOutlined />
          </motion.button>
        ) : (
          <motion.button
            className={twMerge(
              'flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-blue-500 text-white',
            )}
            type="submit"
          >
            <CheckOutlined fontSize="small" />
          </motion.button>
        )}
      </div>
    </ProductWizardPanel>
  )
}

export interface JourneyStepProps extends PropsWithChildren {
  title: string
  description: string
}

export const JourneyStep = ({
  title,
  description,
  children,
}: JourneyStepProps) => {
  return (
    <Section className="md:py-0" title={title} description={description}>
      {children}
    </Section>
  )
}

export interface ProductWizardProps {
  organization: Organization
}

export const ProductWizard = ({ organization }: ProductWizardProps) => {
  const {
    form,
    control,
    handleSubmit,
    onSubmit,
    prices,
    append,
    pricingType,
    setPricingType,
    amountType,
    setAmountType,
    pricesFieldArray,
    hasMonthlyPrice,
    hasYearlyPrice,
  } = useCreateProductWizard(organization)

  const { clearErrors } = form
  const { errors } = form.formState

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="w-full">
        <Journey
          steps={[
            {
              title: 'Product Information',
              description:
                'Basic product information which helps identify the product',
              children: (
                <div className="flex w-full flex-col gap-y-6">
                  <FormField
                    control={control}
                    name="name"
                    rules={{
                      required: 'This field is required',
                      minLength: 3,
                    }}
                    defaultValue=""
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex flex-row items-center justify-between">
                          <FormLabel>Name</FormLabel>
                        </div>
                        <FormControl>
                          <Input {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="description"
                    rules={{
                      required: 'This field is required',
                    }}
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <div className="flex flex-row items-center justify-between">
                          <FormLabel>Description</FormLabel>
                          <p className="dark:text-polar-500 text-sm text-gray-500">
                            Markdown format
                          </p>
                        </div>
                        <FormControl>
                          <TextArea
                            className="min-h-44 resize-none rounded-2xl font-mono text-xs"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ),
            },
            {
              title: 'Pricing',
              description:
                'Set a one-time price, recurring price or a “pay what you want” pricing model',
              children: (
                <div className="flex w-full flex-col gap-6">
                  <Tabs
                    value={pricingType}
                    onValueChange={(value: string) =>
                      setPricingType(value as ProductPriceType)
                    }
                  >
                    <TabsList className="dark:bg-polar-950 w-full rounded-full bg-gray-100">
                      <TabsTrigger
                        className="flex-grow"
                        value={ProductPriceType.ONE_TIME}
                      >
                        Pay Once
                      </TabsTrigger>
                      <TabsTrigger
                        className="flex-grow"
                        value={ProductPriceType.RECURRING}
                      >
                        Subscription
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Select
                    value={amountType}
                    onValueChange={(value) =>
                      setAmountType(value as 'fixed' | 'custom' | 'free')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed price</SelectItem>
                      {pricingType === ProductPriceType.ONE_TIME && (
                        <SelectItem value="custom">
                          Pay what you want
                        </SelectItem>
                      )}
                      <SelectItem value="free">Free</SelectItem>
                    </SelectContent>
                  </Select>
                  {prices.map((price, index) => (
                    <>
                      {amountType === 'fixed' && (
                        <ProductPriceItem
                          key={price.id}
                          index={index}
                          fieldArray={pricesFieldArray}
                          deletable={false}
                        />
                      )}
                      {amountType === 'custom' && (
                        <ProductPriceCustomItem key={price.id} index={index} />
                      )}
                      {amountType === 'free' && (
                        <ProductPriceFreeItem key={price.id} index={index} />
                      )}
                    </>
                  ))}
                  {amountType !== 'free' &&
                    pricingType === ProductPriceType.RECURRING && (
                      <div className="flex flex-row gap-2">
                        {!hasMonthlyPrice && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="self-start"
                            type="button"
                            onClick={() => {
                              append({
                                type: 'recurring',
                                amount_type: 'fixed',
                                recurring_interval:
                                  SubscriptionRecurringInterval.MONTH,
                                price_currency: 'usd',
                                price_amount: 0,
                              })
                              clearErrors('prices')
                            }}
                          >
                            Add monthly pricing
                          </Button>
                        )}
                        {!hasYearlyPrice && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="self-start"
                            type="button"
                            onClick={() => {
                              append({
                                type: 'recurring',
                                amount_type: 'fixed',
                                recurring_interval:
                                  SubscriptionRecurringInterval.YEAR,
                                price_currency: 'usd',
                                price_amount: 0,
                              })
                              clearErrors('prices')
                            }}
                          >
                            Add yearly pricing
                          </Button>
                        )}
                      </div>
                    )}
                  <ErrorMessage
                    errors={errors}
                    name="prices"
                    render={({ message }) => (
                      <p className="text-destructive text-sm font-medium">
                        {message}
                      </p>
                    )}
                  />
                </div>
              ),
            },
            {
              title: 'Media',
              description:
                'Enhance the product page with medias, giving the customers a better idea of the product',
              children: (
                <FormField
                  control={control}
                  name="full_medias"
                  render={({ field }) => (
                    <FormItem className="flex w-full flex-col gap-2">
                      <FormControl>
                        <ProductMediasField
                          organization={organization}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ),
            },
          ]}
        />
      </form>
    </Form>
  )
}
