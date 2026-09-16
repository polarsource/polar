'use client'

import { schemas } from '@polar-sh/client'
import { useVoidDataSource } from './dataSource'
import { VoidDefinitionSelectorFixture } from './VoidDefinitionSelectorFixture'
import { VoidDefinitionSelectorLive } from './VoidDefinitionSelectorLive'

export const VoidDefinitionSelector = ({
  organization,
}: {
  organization: schemas['Organization']
}) =>
  useVoidDataSource() === 'live' ? (
    <VoidDefinitionSelectorLive organization={organization} />
  ) : (
    <VoidDefinitionSelectorFixture />
  )
