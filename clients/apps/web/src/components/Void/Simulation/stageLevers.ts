import { useMemo, useState } from 'react'
import type { VoidConfiguration } from '../api'
import { emptyConfiguration, type Configuration } from '../Stage/diff'
import { useStage } from '../Stage/queries'
import {
  configurationFromLevers,
  DEFAULT_ASSUMPTIONS,
  leversFromConfiguration,
  patchFromLevers,
} from './baseline'
import type { ScenarioLevers } from './types'

const asVoid = (configuration: Configuration) =>
  configuration as unknown as VoidConfiguration

export const useStageLevers = (
  applied: Configuration,
  staged: Configuration | undefined,
) => {
  const baseLevers = useMemo(
    () => leversFromConfiguration(asVoid(applied), DEFAULT_ASSUMPTIONS),
    [applied],
  )
  const stagedLevers = useMemo(
    () =>
      staged
        ? leversFromConfiguration(asVoid(staged), DEFAULT_ASSUMPTIONS)
        : null,
    [staged],
  )
  const [draft, setDraft] = useState<{
    source: Configuration
    levers: ScenarioLevers
  } | null>(null)
  const levers = draft && draft.source === staged ? draft.levers : stagedLevers

  const edit = (mutate: (levers: ScenarioLevers) => void) => {
    if (!staged || !levers) return
    const next = structuredClone(levers)
    mutate(next)
    setDraft({ source: staged, levers: next })
  }

  const patch = useMemo(
    () => (staged && levers ? patchFromLevers(levers, asVoid(staged)) : null),
    [levers, staged],
  )
  const dirty =
    !!patch &&
    Object.keys(patch.products).length + Object.keys(patch.meters).length > 0

  const configuration = () =>
    staged && levers
      ? (configurationFromLevers(
          levers,
          asVoid(staged),
        ) as unknown as Configuration)
      : null

  return {
    baseLevers,
    stagedLevers,
    levers,
    dirty,
    edit,
    discard: () => setDraft(null),
    configuration,
  }
}

export type StageLevers = ReturnType<typeof useStageLevers>

export const useStagePreview = (organizationId: string) => {
  const { stage, applied, configuration } = useStage(organizationId)
  const comparable = applied ? !!configuration.data : true
  const preview = useMemo(
    () =>
      stage.data && comparable
        ? {
            revision: stage.data.revision,
            baseLevers: leversFromConfiguration(
              asVoid(configuration.data ?? emptyConfiguration),
              DEFAULT_ASSUMPTIONS,
            ),
            levers: leversFromConfiguration(
              asVoid(stage.data.configuration),
              DEFAULT_ASSUMPTIONS,
            ),
          }
        : null,
    [stage.data, comparable, configuration.data],
  )
  return preview
}
