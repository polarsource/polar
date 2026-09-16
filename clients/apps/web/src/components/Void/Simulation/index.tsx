'use client'

import { useVoidDataSource } from '../dataSource'
import { VoidScenarioPage as FixtureScenarioPage } from './fixture/VoidScenarioPage'
import { VoidSimulationList as FixtureSimulationList } from './fixture/VoidSimulationList'
import { VoidScenarioPage as LiveScenarioPage } from './VoidScenarioPage'
import { VoidSimulationList as LiveSimulationList } from './VoidSimulationList'

/**
 * Simulate has two implementations: the fixture one from before the Void API
 * was wired in, kept verbatim under `./fixture`, and the live one backed by
 * branches. The data source toggle picks which renders.
 */
export const SimulationListPage = () =>
  useVoidDataSource() === 'live' ? (
    <LiveSimulationList />
  ) : (
    <FixtureSimulationList />
  )

export const ScenarioPage = () =>
  useVoidDataSource() === 'live' ? (
    <LiveScenarioPage />
  ) : (
    <FixtureScenarioPage />
  )
