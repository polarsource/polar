'use client'

import { schemas } from '@polar-sh/client'
import { Button, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { ExternalLinkIcon } from 'lucide-react'
import Link from 'next/link'
import { Fragment, useState } from 'react'
import { StatusIcon } from '../StatusIcon'

type Status = schemas['OrganizationReviewCheckStatus']

export const LearnMore = ({ href }: { href: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="dark:text-polar-300 dark:hover:text-polar-100 inline-flex items-baseline gap-x-1 text-gray-700 underline underline-offset-2 hover:text-gray-900"
  >
    Learn more
    <ExternalLinkIcon className="h-3 w-3 translate-y-0.5" />
  </a>
)

interface TodoProps {
  status: Status
  title: string
  description?: string
  hint?: string
  hintColor?: 'gray' | 'blue'
  actionLabel: string
  onAction: () => void
}

export const Todo = ({
  status,
  title,
  description,
  hint,
  hintColor,
  actionLabel,
  onAction,
}: TodoProps) => (
  <Box alignItems="center" columnGap="s">
    <StatusIcon status={status} />
    <Box flexDirection="column" rowGap="none">
      <Box alignItems="center" columnGap="s">
        <Text variant="label">{title}</Text>
        {hint && hintColor && <Pill color={hintColor}>{hint}</Pill>}
      </Box>
      {description && (
        <Text variant="caption" color="muted">
          {description}
        </Text>
      )}
    </Box>
    {status !== 'passed' && (
      <Box display="block" marginLeft="auto">
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      </Box>
    )}
  </Box>
)

type DeliveryMethod = 'benefit' | 'success-url'

interface DeliveryRadioProps {
  id: string
  value: DeliveryMethod
  label: string
  description: string
  children?: React.ReactNode
}

const DeliveryRadio = ({
  id,
  value,
  label,
  description,
  children,
}: DeliveryRadioProps) => (
  <Box flexDirection="column" rowGap="s">
    <Box
      as="label"
      htmlFor={id}
      flexDirection="column"
      rowGap="xs"
      cursor={{ hover: 'pointer' }}
    >
      <Box alignItems="center" columnGap="s">
        <RadioGroupItem value={value} id={id} />
        <Text variant="label">{label}</Text>
      </Box>
      <Box marginLeft="xl">
        <Text variant="caption" color="muted">
          {description}
        </Text>
      </Box>
    </Box>
    {children && (
      <Box display="block" marginLeft="xl">
        {children}
      </Box>
    )}
  </Box>
)

interface DeliveryRadioGroupProps {
  productsMissingBenefit: { id: string; name: string; href: string }[]
  onAddBenefit: () => void
  onAddSuccessUrl: () => void
}

export const DeliveryRadioGroup = ({
  productsMissingBenefit,
  onAddBenefit,
  onAddSuccessUrl,
}: DeliveryRadioGroupProps) => {
  const [method, setMethod] = useState<DeliveryMethod>('benefit')
  return (
    <Box flexDirection="column" rowGap="m">
      <Text variant="label">How will customers get what they bought?</Text>
      <RadioGroup
        value={method}
        onValueChange={(value) => setMethod(value as DeliveryMethod)}
        className="grid gap-4"
      >
        <DeliveryRadio
          id="delivery-benefit"
          value="benefit"
          label="Polar delivers it"
          description="License keys, files, GitHub and more."
        >
          {method === 'benefit' &&
            (productsMissingBenefit.length > 0 ? (
              <Text variant="caption" color="muted">
                Missing a benefit:{' '}
                {productsMissingBenefit.map((product, index) => (
                  <Fragment key={product.id}>
                    {index > 0 && ', '}
                    <Link
                      href={product.href}
                      className="dark:text-polar-300 dark:hover:text-polar-100 text-gray-700 underline underline-offset-2 hover:text-gray-900"
                    >
                      {product.name}
                    </Link>
                  </Fragment>
                ))}
              </Text>
            ) : (
              <Box justifyContent="end">
                <Button variant="secondary" size="sm" onClick={onAddBenefit}>
                  Add a benefit
                </Button>
              </Box>
            ))}
        </DeliveryRadio>
        <DeliveryRadio
          id="delivery-success-url"
          value="success-url"
          label="You deliver it"
          description="We redirect buyers to your app after payment, where you grant access."
        >
          {method === 'success-url' && (
            <Box justifyContent="end">
              <Button variant="secondary" size="sm" onClick={onAddSuccessUrl}>
                Add a Success URL
              </Button>
            </Box>
          )}
        </DeliveryRadio>
      </RadioGroup>
    </Box>
  )
}
