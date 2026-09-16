'use client'

import { useVoidDataSource } from '../dataSource'
import { useFixtureScenarios } from './fixtureStore'
import { useLiveScenarios } from './liveStore'

export type { NewScenario } from './fixtureStore'

/** Scenarios from the fixtures or from Void branches, per the data source toggle. */
export const useScenarios = () => {
  const source = useVoidDataSource()
  const fixtures = useFixtureScenarios()
  const live = useLiveScenarios(source === 'live')
  return source === 'live' ? live : fixtures
}
