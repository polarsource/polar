'use client'

import { Input, Text } from '@polar-sh/orbit'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@polar-sh/ui/components/atoms/Accordion'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { BASELINE_LEVERS } from './baseline'
import { useScenarios } from './store'
import { Scenario, ScenarioLevers as Levers } from './types'

interface LeverFieldProps {
  label: string
  value: number
  baseline: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  step?: number
  /** Turns the stored value into the number shown in the input. */
  scale?: number
}

const LeverField = ({
  label,
  value,
  baseline,
  onChange,
  prefix,
  suffix,
  step = 1,
  scale = 1,
}: LeverFieldProps) => {
  const changed = value !== baseline
  return (
    <Box flexDirection="column" rowGap="s">
      <Box alignItems="baseline" justifyContent="between" columnGap="m">
        <Text truncate>{label}</Text>
        {changed ? (
          <Box
            as="span"
            cursor="pointer"
            onClick={() => onChange(baseline)}
            flexShrink={0}
          >
            <Text color="accent" variant="caption">
              Reset
            </Text>
          </Box>
        ) : null}
      </Box>
      <Input
        type="number"
        step={step}
        min={0}
        value={value / scale}
        preSlot={prefix ? <span>{prefix}</span> : undefined}
        postSlot={suffix ? <span>{suffix}</span> : undefined}
        onChange={(event) => {
          const parsed = Number.parseFloat(event.target.value)
          onChange(Number.isNaN(parsed) ? 0 : Math.round(parsed * scale))
        }}
      />
    </Box>
  )
}

const Group = ({
  id,
  title,
  caption,
  children,
}: {
  id: string
  title: string
  caption: string
  children: ReactNode
}) => (
  <AccordionItem
    value={id}
    className="dark:border-polar-700 rounded-none! border-b border-gray-200 px-0!"
  >
    <AccordionTrigger className="py-4 text-left hover:no-underline">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="title" as="h3">
          {title}
        </Text>
        <Text color="muted" variant="caption">
          {caption}
        </Text>
      </Box>
    </AccordionTrigger>
    <AccordionContent>
      <Box flexDirection="column" rowGap="l" paddingBottom="m">
        {children}
      </Box>
    </AccordionContent>
  </AccordionItem>
)

export const ScenarioLevers = ({ scenario }: { scenario: Scenario }) => {
  const { updateLevers } = useScenarios()
  const { levers } = scenario
  const edit = (mutate: (levers: Levers) => void) =>
    updateLevers(scenario.id, mutate)

  return (
    <Box flexDirection="column" rowGap="l" padding="xl">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xxs" as="h2">
          Levers
        </Text>
        <Text color="muted" variant="caption">
          Every change rebills the last 30 days instantly.
        </Text>
      </Box>
      <Accordion type="multiple" className="flex flex-col">
        <Group
          id="plans"
          title="Plans"
          caption="Monthly fee and the usage it includes."
        >
          {levers.plans.map((plan, index) => (
            <Box key={plan.id} flexDirection="column" rowGap="l">
              <LeverField
                label={`${plan.name} price`}
                value={plan.monthlyPrice}
                baseline={BASELINE_LEVERS.plans[index].monthlyPrice}
                prefix="$"
                suffix="/ mo"
                scale={100}
                onChange={(value) =>
                  edit((draft) => {
                    draft.plans[index].monthlyPrice = value
                  })
                }
              />
              <LeverField
                label={`${plan.name} allowance`}
                value={plan.includedUsage}
                baseline={BASELINE_LEVERS.plans[index].includedUsage}
                prefix="$"
                scale={100}
                onChange={(value) =>
                  edit((draft) => {
                    draft.plans[index].includedUsage = value
                  })
                }
              />
            </Box>
          ))}
        </Group>

        <Group
          id="meters"
          title="Meters"
          caption="What one unit of usage costs above the allowance."
        >
          {levers.meters.map((meter, index) => (
            <LeverField
              key={meter.id}
              label={`${meter.name} / ${meter.unit}`}
              value={meter.price}
              baseline={BASELINE_LEVERS.meters[index].price}
              prefix="$"
              step={0.5}
              scale={100}
              onChange={(value) =>
                edit((draft) => {
                  draft.meters[index].price = value
                })
              }
            />
          ))}
        </Group>

        <Group
          id="assumptions"
          title="Assumptions"
          caption="Drive the projection and the churn risk model."
        >
          <LeverField
            label="Usage growth"
            value={levers.assumptions.usageGrowth}
            baseline={BASELINE_LEVERS.assumptions.usageGrowth}
            suffix="% / mo"
            onChange={(value) =>
              edit((draft) => {
                draft.assumptions.usageGrowth = value
              })
            }
          />
          <LeverField
            label="New customers"
            value={levers.assumptions.newCustomers}
            baseline={BASELINE_LEVERS.assumptions.newCustomers}
            suffix="/ mo"
            onChange={(value) =>
              edit((draft) => {
                draft.assumptions.newCustomers = value
              })
            }
          />
          <LeverField
            label="Churn tolerance"
            value={levers.assumptions.churnTolerance}
            baseline={BASELINE_LEVERS.assumptions.churnTolerance}
            suffix="%"
            onChange={(value) =>
              edit((draft) => {
                draft.assumptions.churnTolerance = value
              })
            }
          />
          <LeverField
            label="Churn per 10% over"
            value={levers.assumptions.churnElasticity}
            baseline={BASELINE_LEVERS.assumptions.churnElasticity}
            suffix="%"
            onChange={(value) =>
              edit((draft) => {
                draft.assumptions.churnElasticity = value
              })
            }
          />
        </Group>
      </Accordion>
    </Box>
  )
}
