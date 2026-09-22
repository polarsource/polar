'use client'

import { AnimatePresence, motion } from 'motion/react'
import { short } from './hash'

const EASE = [0.2, 0.8, 0.2, 1] as const

export interface Deployment {
  readonly label: string
  readonly hash: string
  readonly status: 'draft' | 'active' | 'archived'
}

export interface Entry {
  readonly action: 'create' | 'replace' | 'unchanged' | 'orphan'
  readonly kind: string
  readonly key: string
  readonly note?: string
}

const MARK: Record<Entry['action'], { glyph: string; className: string }> = {
  create: { glyph: '+', className: 'text-emerald-700 dark:text-emerald-300' },
  replace: { glyph: '~', className: 'text-amber-600 dark:text-amber-400' },
  unchanged: { glyph: '=', className: 'text-muted-foreground' },
  orphan: { glyph: '?', className: 'text-muted-foreground' },
}

const STATUS: Record<Deployment['status'], string> = {
  draft: 'border-border text-muted-foreground',
  active: 'border-emerald-400 text-emerald-700 dark:text-emerald-300',
  archived: 'border-border text-muted-foreground line-through',
}

/**
 * The organization's deployments as rows, the plan the CLI printed for the
 * last command, and where the runtime resolves slugs. A refused deploy
 * shows the server's reason instead of a plan.
 */
export const Deployments = ({
  deployments,
  command,
  entries = [],
  refused,
  pointer,
  pinned = false,
}: {
  deployments: readonly Deployment[]
  command: string
  entries?: readonly Entry[]
  refused?: string
  /** Hash the runtime resolves against: the active one, or a pinned versionId. */
  pointer?: string
  pinned?: boolean
}) => {
  const summary = (['create', 'replace', 'unchanged', 'orphan'] as const)
    .map(
      (action) =>
        [action, entries.filter((e) => e.action === action).length] as const,
    )
    .filter(([, count]) => count > 0)
    .map(
      ([action, count]) =>
        `${count} ${action === 'create' ? 'to create' : action === 'replace' ? 'to replace' : action === 'orphan' ? 'orphaned' : 'unchanged'}`,
    )
    .join(' · ')

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-baseline justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span>
          <span className="text-muted-foreground">$ </span>
          {command}
        </span>
        <span className="text-muted-foreground">acme · deployments</span>
      </div>
      <div className="divide-border grid min-h-0 flex-1 grid-cols-[minmax(0,5fr)_minmax(0,4fr)] divide-x">
        <div className="flex flex-col gap-2 overflow-auto px-4 py-3">
          <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
            plan
          </span>
          <AnimatePresence initial={false}>
            {refused ? (
              <motion.div
                key="refused"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="rounded-lg border border-red-300 bg-red-50 p-3 font-mono text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              >
                <div className="mb-1">DeploymentConflict</div>
                <div>{refused}</div>
              </motion.div>
            ) : (
              <motion.ul
                key={entries.map((e) => `${e.action}:${e.key}`).join('|')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex flex-col gap-0.5 font-mono text-[11px]"
              >
                {entries.map((entry) => (
                  <li
                    key={`${entry.kind}:${entry.key}`}
                    className="grid grid-cols-[1ch_auto_1fr_auto] gap-x-3"
                  >
                    <span className={MARK[entry.action].className}>
                      {MARK[entry.action].glyph}
                    </span>
                    <span className="text-muted-foreground">{entry.kind}</span>
                    <span
                      className={
                        entry.action === 'unchanged'
                          ? 'text-muted-foreground'
                          : ''
                      }
                    >
                      {entry.key}
                    </span>
                    <span className="text-muted-foreground truncate">
                      {entry.note}
                    </span>
                  </li>
                ))}
                {entries.length > 0 && (
                  <li className="text-muted-foreground border-border mt-1 border-t pt-1">
                    {summary}
                  </li>
                )}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-col gap-2 overflow-auto px-4 py-3">
          <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
            deployments
          </span>
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {deployments.map((deployment) => (
                <motion.li
                  key={deployment.hash}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={`flex items-baseline justify-between gap-3 rounded-lg border px-3 py-1.5 font-mono text-[11px] ${STATUS[deployment.status]}`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="text-foreground no-underline">
                      {deployment.label}
                    </span>
                    <span className="text-muted-foreground">
                      {short(deployment.hash)}
                    </span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    {pointer === deployment.hash && (
                      <span className="text-foreground">
                        ◂ runtime{pinned ? ' · pinned' : ''}
                      </span>
                    )}
                    <span>{deployment.status}</span>
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  )
}
