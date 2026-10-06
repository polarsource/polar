'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Button, Grid, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useContext, useMemo } from 'react'
import { useModal } from '@/components/Modal/useModal'
import { stageReviewHref } from '../Stage/queries'
import { changedLevers } from './baseline'
import { CustomerUsage, replay } from './engine'
import { useSimulationCustomers } from './customers'
import { Delta } from './Delta'
import { shortDate, usd } from './format'
import { ScenarioModal } from './ScenarioModal'
import { ScenarioChart } from './ScenarioChart'
import { useStagePreview } from './stageLevers'
import { useScenarios } from './store'
import { DailyPoint, Scenario } from './types'

interface Card {
  id: string
  name: string
  basedOn: string
  changes: number
  promotedAs: string | null
  baseline: number
  scenario: number
  daily: DailyPoint[]
  updatedAt: string
}

const toCard = (
  scenario: Pick<
    Scenario,
    'id' | 'name' | 'levers' | 'baseLevers' | 'promotedAs' | 'updatedAt'
  > & { basedOn: { label: string } },
  customers: CustomerUsage[],
): Card => {
  const { totals, daily } = replay(
    scenario.levers,
    scenario.baseLevers,
    customers,
  )
  return {
    id: scenario.id,
    name: scenario.name,
    basedOn: scenario.basedOn.label,
    changes: changedLevers(scenario.levers, scenario.baseLevers).length,
    promotedAs: scenario.promotedAs,
    baseline: totals.baseline,
    scenario: totals.scenario,
    daily,
    updatedAt: scenario.updatedAt,
  }
}

const ScenarioCard = ({
  card,
  href,
  draft = false,
}: {
  card: Card
  href: string
  draft?: boolean
}) => {
  const delta = card.scenario - card.baseline
  const ratio = card.baseline > 0 ? delta / card.baseline : null
  return (
    <Link href={href}>
      <Box
        flexDirection="column"
        rowGap="l"
        height="100%"
        padding="2xl"
        borderRadius="xl"
        backgroundColor={draft ? 'background-accent' : 'background-card'}
        transitionProperty="colors"
        transitionDuration="fast"
        cursor="pointer"
      >
        <Box flexDirection="column" flexGrow={1} rowGap="2xl">
          <Box flexDirection="column" rowGap="m">
            <Box alignItems="baseline" justifyContent="between" columnGap="s">
              <Box alignItems="center" columnGap="s" minWidth={0}>
                <Text truncate variant="heading-xxs">
                  {card.name}
                </Text>
                {draft ? (
                  <Status status="Staged" color="blue" size="small" />
                ) : null}
              </Box>
              <Text color="muted" variant="body">
                {card.basedOn}
              </Text>
            </Box>
          </Box>
        </Box>
        <Box flexDirection="column" rowGap="s">
          <Text variant="heading-s">{usd(card.scenario)}</Text>
          <Delta delta={delta} ratio={ratio} suffix="over 30 days" />
        </Box>

        <Box marginHorizontal="-xl" marginBottom="-2xl">
          <ScenarioChart
            data={card.daily}
            keys={['baseline', 'scenario']}
            xAxisFormatter={shortDate}
            height={96}
            simple
            bare
          />
        </Box>
      </Box>
    </Link>
  )
}

export const VoidSimulationList = () => {
  const router = useRouter()
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}/simulate`
  const { scenarios, create, isLoading, error } = useScenarios()
  const stage = useStagePreview(organization.id)
  const customers = useSimulationCustomers(organization.id, [
    ...scenarios,
    ...(stage ? [stage] : []),
  ])
  const cards = useMemo(
    () =>
      customers.data
        ? scenarios.map((scenario) => toCard(scenario, customers.data))
        : [],
    [scenarios, customers.data],
  )
  const currentDraft = useMemo(
    () =>
      stage && customers.data
        ? toCard(
            {
              ...stage,
              id: 'stage',
              name: 'Current draft',
              basedOn: { label: `Revision ${stage.revision}` },
              promotedAs: null,
              updatedAt: '',
            },
            customers.data,
          )
        : null,
    [stage, customers.data],
  )
  const { isShown, show, hide } = useModal()

  if (isLoading || customers.isLoading || error || customers.error) {
    return (
      <DashboardBody title="Simulate">
        <Text>
          {error?.message ?? customers.error?.message ?? 'Loading simulation…'}
        </Text>
      </DashboardBody>
    )
  }

  return (
    <DashboardBody
      title="Simulate"
      header={<Button onClick={show}>New scenario</Button>}
    >
      <ScenarioModal
        isShown={isShown}
        hide={hide}
        title="New scenario"
        submitLabel="Create scenario"
        onSubmit={async (input) =>
          router.push(`${base}/${(await create(input)).id}`)
        }
      />
      <Grid
        templateColumns={{
          base: 'minmax(0, 1fr)',
          md: 'repeat(2, minmax(0, 1fr))',
          xl: 'repeat(3, minmax(0, 1fr))',
        }}
        gap="xl"
      >
        {currentDraft ? (
          <ScenarioCard
            card={currentDraft}
            href={stageReviewHref(organization.slug)}
            draft
          />
        ) : null}
        {cards.map((card) => (
          <ScenarioCard key={card.id} card={card} href={`${base}/${card.id}`} />
        ))}
      </Grid>
    </DashboardBody>
  )
}
