'use client'

import { useVoidDataSource } from '@/components/Void/dataSource'
import { AssistantBlock } from '@/hooks/useCompassAssistant'
import { schemas } from '@polar-sh/client'
import { SimulationBlockViewFixture } from './SimulationBlockViewFixture'
import { SimulationBlockViewLive } from './SimulationBlockViewLive'

export const SimulationBlockView = (props: {
  block: Extract<AssistantBlock, { type: 'simulation' }>
  organization: schemas['Organization']
}) =>
  useVoidDataSource() === 'live' ? (
    <SimulationBlockViewLive {...props} />
  ) : (
    <SimulationBlockViewFixture {...props} />
  )
