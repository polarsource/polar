'use client'

import { AnimatePresence, motion } from 'motion/react'
import type { TierCheck } from './llm'

const EASE = [0.2, 0.8, 0.2, 1] as const

export type Stage = 'idle' | 'gate' | 'gateway' | 'provider' | 'record'

export interface Call {
  readonly identity: string
  readonly model: string
  readonly tags: Record<string, string>
  readonly estimate: {
    readonly inputTokens: number
    readonly maxOutputTokens: number
    readonly credits: number
  }
  readonly remaining: number
  readonly usage?: { readonly input: number; readonly output: number }
  readonly credits?: number
  readonly cost?: number
  readonly callId?: string
}

export interface SpanRow {
  readonly key: string
  readonly activity: string
  readonly cost: number
  readonly waste: number | null
  readonly due: string | null
}

export interface Report {
  readonly totals: {
    readonly cost: number
    readonly labeled: number
    readonly pending: number
  }
  readonly byActivity: readonly {
    readonly slug: string
    readonly cost: number
    readonly waste: number
  }[]
}

const n = (value: number) => value.toLocaleString('en-US')
const usd = (value: number) => `$${value.toFixed(4)}`

const ORDER: Stage[] = ['idle', 'gate', 'gateway', 'provider', 'record']
const reached = (stage: Stage, target: Stage) =>
  ORDER.indexOf(stage) >= ORDER.indexOf(target)

const Box = ({
  title,
  active,
  done,
  danger,
  children,
}: {
  title: string
  active: boolean
  done: boolean
  danger?: boolean
  children?: React.ReactNode
}) => (
  <motion.div
    layout
    className={`bg-card flex min-w-0 flex-1 flex-col gap-1 rounded-xl border px-3 py-2 font-mono text-[11px] ${
      danger
        ? 'border-red-400'
        : active
          ? 'border-foreground'
          : done
            ? 'border-foreground/40'
            : 'border-border text-muted-foreground'
    }`}
    transition={{ duration: 0.3, ease: EASE }}
  >
    <span
      className={danger ? 'text-red-600 dark:text-red-400' : 'text-foreground'}
    >
      {title}
    </span>
    {children}
  </motion.div>
)

const Arrow = ({ lit }: { lit: boolean }) => (
  <span
    className={`shrink-0 self-center px-1 ${lit ? 'text-foreground' : 'text-border'}`}
  >
    →
  </span>
)

/**
 * One model call through the plugin: the app asks for a metered model, the
 * gate estimates and checks, the gateway stamps who is calling, the
 * provider answers with usage, and one completion event is recorded and
 * climbs the identity tree. Later steps hang a ladder or activity spans below.
 */
export const LlmPipeline = ({
  stage,
  call,
  denied = false,
  tiers,
  spans,
  report,
  captured = false,
}: {
  stage: Stage
  call: Call
  denied?: boolean
  tiers?: readonly TierCheck[]
  spans?: readonly SpanRow[]
  report?: Report
  captured?: boolean
}) => {
  const gate = reached(stage, 'gate')
  const gateway = reached(stage, 'gateway') && !denied
  const provider = reached(stage, 'provider') && !denied
  const record = reached(stage, 'record') && !denied
  const chain = ['nightly', 'alice', 'acme']

  return (
    <div className="flex h-full flex-col">
      <div className="border-border text-muted-foreground flex items-baseline justify-between border-b px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase">
        <span>llm plugin · assistant</span>
        <span>
          as {call.identity} · {call.model}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 py-4">
        <div className="flex items-stretch">
          <Box
            title={captured ? 'app · streamText' : 'app · scope.ai.model'}
            active={stage === 'idle'}
            done={stage !== 'idle'}
          >
            <span>
              {captured
                ? 'plain model, inside a run'
                : 'metered model, gate block'}
            </span>
            {Object.keys(call.tags).length > 0 && (
              <span className="text-muted-foreground">
                tags{' '}
                {Object.entries(call.tags)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ')}
              </span>
            )}
          </Box>
          <Arrow lit={gate} />
          <Box
            title="gate · check"
            active={stage === 'gate'}
            done={gateway}
            danger={denied}
          >
            {gate && (
              <>
                <span>
                  ~{n(call.estimate.inputTokens)} in ·{' '}
                  {n(call.estimate.maxOutputTokens)} out max
                </span>
                <span>
                  ≈ {n(call.estimate.credits)} credits vs {n(call.remaining)}{' '}
                  left
                </span>
                <span
                  className={
                    denied
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }
                >
                  {denied ? 'denied · reason cap' : 'allowed'}
                </span>
              </>
            )}
          </Box>
          <Arrow lit={gateway} />
          <Box
            title="gateway · vercel"
            active={stage === 'gateway'}
            done={provider}
          >
            {gateway && (
              <>
                <span>providerOptions.gateway</span>
                <span className="text-muted-foreground">
                  user: {call.identity}
                  {Object.keys(call.tags).length > 0 &&
                    ` · tags: ${Object.entries(call.tags)
                      .map(([k, v]) => `${k}:${v}`)
                      .join(', ')}`}
                </span>
              </>
            )}
          </Box>
          <Arrow lit={provider} />
          <Box title="provider" active={stage === 'provider'} done={record}>
            {provider && call.usage && (
              <>
                <span>
                  usage {n(call.usage.input)} in · {n(call.usage.output)} out
                </span>
                {call.cost !== undefined && (
                  <span className="text-muted-foreground">
                    cost {usd(call.cost)} reported
                  </span>
                )}
              </>
            )}
          </Box>
        </div>

        <AnimatePresence initial={false}>
          {record && call.usage && (
            <motion.div
              key="completion"
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4"
            >
              <div className="border-border rounded-xl border p-3 font-mono text-[11px]">
                <div className="mb-1 flex justify-between">
                  <span>assistant.completion</span>
                  <span className="text-muted-foreground">
                    recorded as {call.identity}
                  </span>
                </div>
                <div className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                  <span>model</span>
                  <span className="text-right">{call.model}</span>
                  <span>input_tokens</span>
                  <span className="text-right">{n(call.usage.input)}</span>
                  <span>output_tokens</span>
                  <span className="text-right">{n(call.usage.output)}</span>
                  <span>credits</span>
                  <span className="text-foreground text-right">
                    {call.credits ?? '—'}
                  </span>
                  <span>cost · cost_source</span>
                  <span className="text-right">
                    {call.cost === undefined
                      ? 'null'
                      : `${usd(call.cost)} · gateway`}
                  </span>
                  <span>call_id</span>
                  <span className="text-right">{call.callId ?? 'null'}</span>
                </div>
              </div>
              <div className="border-border flex flex-col justify-between rounded-xl border p-3 font-mono text-[11px]">
                <span className="text-muted-foreground">
                  assistant-credits · usage climbs
                </span>
                {chain.map((id, i) => (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      delay: (chain.length - 1 - i) * 0.4,
                      duration: 0.3,
                    }}
                    className="flex justify-between"
                  >
                    <span>{id}</span>
                    <span className="tabular-nums">+{call.credits ?? 0}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {tiers && (
            <motion.div
              key="ladder"
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="border-border rounded-xl border p-3 font-mono text-[11px]"
            >
              <div className="mb-1 flex justify-between">
                <span>fallback ladder</span>
                <span className="text-muted-foreground">
                  {n(call.remaining)} credits left
                </span>
              </div>
              {tiers.map((tier) => (
                <div
                  key={tier.model}
                  className="flex items-baseline justify-between gap-3 py-0.5"
                >
                  <span
                    className={
                      tier.ran ? 'text-foreground' : 'text-muted-foreground'
                    }
                  >
                    {tier.model}
                  </span>
                  <span className="text-muted-foreground">
                    ≈ {n(tier.estimate)} credits
                  </span>
                  <span
                    className={
                      tier.ran
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : tier.allowed
                          ? 'text-muted-foreground'
                          : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {tier.ran
                      ? 'ran'
                      : tier.allowed
                        ? 'allowed'
                        : 'skipped · denied'}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {spans && (
            <motion.div
              key="spans"
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="border-border rounded-xl border p-3 font-mono text-[11px]"
            >
              <div className="text-muted-foreground mb-1 grid grid-cols-[1fr_auto_auto_auto] gap-x-4">
                <span>span_key</span>
                <span>activity</span>
                <span>cost</span>
                <span>due_at</span>
              </div>
              {spans.map((span) => (
                <div
                  key={span.key}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 py-0.5"
                >
                  <span className="truncate">{span.key}</span>
                  <span
                    className={
                      span.activity === 'pending'
                        ? 'text-muted-foreground'
                        : span.activity === 'retry'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-foreground'
                    }
                  >
                    {span.activity}
                    {span.waste !== null && span.waste > 0
                      ? ` · waste ${span.waste.toFixed(2)}`
                      : ''}
                  </span>
                  <span className="tabular-nums">{usd(span.cost)}</span>
                  <span className="text-muted-foreground">
                    {span.due ?? '—'}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {report && (
            <motion.div
              key="report"
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="border-border flex flex-col gap-2 rounded-xl border p-3 font-mono text-[11px]"
            >
              <div className="flex justify-between">
                <span>activities.list() · by_activity</span>
                <span className="text-muted-foreground">
                  {usd(report.totals.cost)} · {usd(report.totals.pending)}{' '}
                  pending
                </span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full">
                {report.byActivity.map((row, i) => (
                  <div
                    key={row.slug}
                    className={
                      row.slug === 'retry'
                        ? 'bg-amber-500'
                        : [
                            'bg-foreground',
                            'bg-foreground/70',
                            'bg-foreground/45',
                            'bg-foreground/25',
                          ][i % 4]
                    }
                    style={{
                      width: `${(row.cost / report.totals.cost) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                {report.byActivity.map((row) => (
                  <span key={row.slug}>
                    {row.slug} {usd(row.cost)}
                    {row.waste > 0 ? ` · waste ${usd(row.waste)}` : ''}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
