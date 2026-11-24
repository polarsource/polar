import { isIncompleteStep } from '@/components/Finance/Account/sections/stepLabels'
import { schemas } from '@polar-sh/client'
import type { Step } from './SetupCards'

type Run = schemas['AgentSetupRun']
type Check = schemas['OrganizationReviewCheck']
type CheckKey = schemas['OrganizationReviewCheckKey']

export type AgentRow = { key: string } & (
  | { step: Step }
  | { check: Check; label: string }
)

const STAGES: {
  stage: schemas['AgentSetupStage']
  label: string
  check?: CheckKey
}[] = [
  { stage: 'connect', label: 'Connect' },
  { stage: 'analyze', label: 'Understand your app' },
  { stage: 'checkout', label: 'Set up checkout', check: 'setup_readiness' },
  {
    stage: 'products',
    label: 'Create your products',
    check: 'product_configuration',
  },
]

const PROFILE_CHECKS: { check: CheckKey; label: string }[] = [
  { check: 'product_url', label: 'Find your product website' },
  { check: 'identity.email', label: 'Find your support email' },
  { check: 'identity.social_links', label: 'Find your social links' },
]

const AGENT_CHECKS = new Set<CheckKey | undefined>([
  ...STAGES.map(({ check }) => check),
  ...PROFILE_CHECKS.map(({ check }) => check),
])

export const userChecks = (checks: Check[]) => {
  const own = checks.filter((check) => !AGENT_CHECKS.has(check.key))
  return [
    ...own.filter((check) => check.key !== 'payout_account'),
    ...own.filter((check) => check.key === 'payout_account'),
  ]
}

export const isDone = (check: Check) => !isIncompleteStep(check)

const passed = (check: Check | undefined) => !!check && isDone(check)

export const plansAwaitApproval = (run: Run | null | undefined) =>
  !!run && !run.approved_at && (run.drafts?.products?.length ?? 0) > 0

export const waitingStage = (run: Run | null | undefined) =>
  Object.values(run?.stages ?? {}).find((stage) => stage.status === 'waiting')

const stageRows = (
  run: Run | null | undefined,
  checks: Check[],
): AgentRow[] => {
  let activeTaken = !run
  return STAGES.map(({ stage, label, check }) => {
    const reported = run?.stages[stage]
    const base = { key: stage, label, description: reported?.note }
    if (
      reported?.status === 'done' ||
      passed(checks.find(({ key }) => key === check))
    ) {
      return { key: stage, step: { ...base, state: 'done' } }
    }
    if (reported?.status === 'waiting') {
      activeTaken = true
      return { key: stage, step: { ...base, state: 'waiting' } }
    }
    if (stage === 'products' && plansAwaitApproval(run)) {
      return {
        key: stage,
        step: {
          ...base,
          state: 'waiting',
          description: 'Waiting for you to approve the plans',
        },
      }
    }
    if (activeTaken && reported?.status !== 'in_progress') {
      return { key: stage, step: { ...base, state: 'pending' } }
    }
    activeTaken = true
    return {
      key: stage,
      step: {
        ...base,
        state: 'active',
        description:
          reported?.note ??
          (stage === 'connect' ? 'Waiting for your agent' : undefined),
      },
    }
  })
}

const profileRows = (
  run: Run | null | undefined,
  checks: Check[],
): AgentRow[] => {
  const connected = Object.keys(run?.stages ?? {}).length > 0
  const hasUnderstoodApp = run?.stages.analyze?.status === 'done'
  return PROFILE_CHECKS.flatMap(({ check: key, label }): AgentRow[] => {
    const check = checks.find((candidate) => candidate.key === key)
    if (!check) {
      return []
    }
    if (passed(check)) {
      return [
        { key, step: { key, label, state: 'done', description: check.value } },
      ]
    }
    if (hasUnderstoodApp) {
      return [{ key, check, label }]
    }
    return [
      { key, step: { key, label, state: connected ? 'active' : 'pending' } },
    ]
  })
}

export const agentRows = (
  run: Run | null | undefined,
  checks: Check[],
): AgentRow[] => {
  const [connect, analyze, ...rest] = stageRows(run, checks)
  return [connect, analyze, ...profileRows(run, checks), ...rest].filter(
    (row) => row !== undefined,
  )
}
