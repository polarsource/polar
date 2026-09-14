'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useContext, useMemo } from 'react'
import { useModal } from '@/components/Modal/useModal'
import { changedLevers } from './baseline'
import { replay } from './engine'
import { Delta } from './Delta'
import { shortDate, usd } from './format'
import { ScenarioModal } from './ScenarioModal'
import { ScenarioChart } from './ScenarioChart'
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

const toCard = (scenario: Scenario): Card => {
  const { totals, daily } = replay(scenario.levers)
  return {
    id: scenario.id,
    name: scenario.name,
    basedOn: `${scenario.basedOn.definition} · ${scenario.basedOn.version}`,
    changes: changedLevers(scenario.levers).length,
    promotedAs: scenario.promotedAs,
    baseline: totals.baseline,
    scenario: totals.scenario,
    daily,
    updatedAt: scenario.updatedAt,
  }
}

const ScenarioCard = ({ card, href }: { card: Card; href: string }) => {
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
        backgroundColor="background-card"
        transitionProperty="colors"
        transitionDuration="fast"
        cursor="pointer"
      >
        <Box flexDirection="column" flexGrow={1} rowGap="2xl">
          <Box flexDirection="column" rowGap="m">
            <Box alignItems="baseline" justifyContent="between" columnGap="s">
              <Text truncate variant="heading-xxs">
                {card.name}
              </Text>
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

        <Box marginHorizontal="-xl" marginBottom="-xl">
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
  const base = `/void/dashboard/${organization.slug}/definition/simulate`
  const { scenarios, create } = useScenarios()
  const cards = useMemo(() => scenarios.map(toCard), [scenarios])
  const { isShown, show, hide } = useModal()

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
        onSubmit={(input) => router.push(`${base}/${create(input).id}`)}
      />
      <Grid
        templateColumns={{
          base: 'minmax(0, 1fr)',
          md: 'repeat(2, minmax(0, 1fr))',
          xl: 'repeat(3, minmax(0, 1fr))',
        }}
        gap="xl"
      >
        {cards.map((card) => (
          <ScenarioCard key={card.id} card={card} href={`${base}/${card.id}`} />
        ))}
      </Grid>
    </DashboardBody>
  )
}
