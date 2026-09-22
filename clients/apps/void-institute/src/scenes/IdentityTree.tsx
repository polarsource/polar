'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import {
  chain as chainOf,
  check as runCheck,
  children,
  features,
  subtreeUsage,
  type Tree,
} from './tree'

const EASE = [0.2, 0.8, 0.2, 1] as const
const NODE = { w: 176, h: 58 }
const ROW = [8, 104, 200]
const HEIGHT = ROW[2]! + NODE.h + 8
const LEG_S = 0.5

const n = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('en-US')

interface Placed {
  readonly id: string
  readonly x: number
  readonly y: number
}

/** Root centred, members spread across the width, agents spread under their member. */
const place = (tree: Tree, width: number): ReadonlyMap<string, Placed> => {
  const at = new Map<string, Placed>()
  const root = tree.nodes.find((node) => node.parent === null)
  if (!root) return at
  at.set(root.id, { id: root.id, x: width / 2, y: ROW[0]! })
  const members = children(tree, root.id)
  const slots = members.reduce(
    (sum, member) => sum + Math.max(1, children(tree, member.id).length),
    0,
  )
  let x0 = 0
  for (const member of members) {
    const agents = children(tree, member.id)
    const band = (width * Math.max(1, agents.length)) / Math.max(1, slots)
    at.set(member.id, { id: member.id, x: x0 + band / 2, y: ROW[1]! })
    agents.forEach((agent, i) =>
      at.set(agent.id, {
        id: agent.id,
        x: x0 + (band * (i + 0.5)) / agents.length,
        y: ROW[2]!,
      }),
    )
    x0 += band
  }
  return at
}

const edge = (child: Placed, parent: Placed) => {
  const y2 = parent.y + NODE.h
  const mid = (child.y + y2) / 2
  return `M ${child.x} ${child.y} C ${child.x} ${mid}, ${parent.x} ${mid}, ${parent.x} ${y2}`
}

export interface Pulse {
  readonly id: string
  readonly from: string
  readonly amount: number
}

/**
 * The identity tree on one meter. Every node shows what its subtree spent
 * and what narrows it. A recorded event climbs from its identity to the
 * root; a check lights the chain it walked and names the holder that
 * answered.
 */
export const IdentityTree = ({
  tree,
  pulse,
  check,
}: {
  tree: Tree
  pulse?: Pulse
  check?: { id: string; estimate: number }
}) => {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const at = place(tree, Math.max(width - 16, 0))
  const result = check ? runCheck(tree, check.id, check.estimate) : null
  const lit = new Set(result ? chainOf(tree, check!.id) : [])
  const climb = pulse ? chainOf(tree, pulse.from) : []

  return (
    <div className="flex h-full flex-col">
      <div className="border-border text-muted-foreground flex items-baseline justify-between border-b px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase">
        <span>identities · bandwidth</span>
        <span>
          {tree.holder.id} holds {n(tree.holder.term.included)} ·{' '}
          {tree.holder.term.limit}
        </span>
      </div>
      <div
        ref={box}
        className="relative shrink-0 overflow-hidden px-2 pt-2"
        style={{ height: HEIGHT + 8 }}
      >
        {width > 0 && (
          <div className="relative" style={{ height: HEIGHT }}>
            <svg
              className="pointer-events-none absolute inset-0"
              width="100%"
              height={HEIGHT}
            >
              {tree.nodes.map((node) => {
                const child = at.get(node.id)
                const parent = node.parent ? at.get(node.parent) : undefined
                if (!child || !parent) return null
                return (
                  <path
                    key={node.id}
                    d={edge(child, parent)}
                    fill="none"
                    className={
                      lit.has(node.id) && lit.has(parent.id)
                        ? 'stroke-foreground'
                        : 'stroke-border'
                    }
                    strokeWidth={1.5}
                  />
                )
              })}
            </svg>
            {pulse &&
              climb.slice(0, -1).map((id, leg) => {
                const child = at.get(id)
                const parent = at.get(climb[leg + 1]!)
                if (!child || !parent) return null
                return (
                  <span
                    key={`${pulse.id}:${id}`}
                    className="tree-dot bg-foreground absolute top-0 left-0 size-2.5 rounded-full"
                    style={{
                      offsetPath: `path('${edge(child, parent)}')`,
                      animationDelay: `${leg * LEG_S}s`,
                      animationDuration: `${LEG_S}s`,
                    }}
                  />
                )
              })}
            {tree.nodes.map((node) => {
              const placed = at.get(node.id)
              if (!placed) return null
              const isHolder = node.id === tree.holder.id
              const used = subtreeUsage(tree, node.id)
              const own = features(tree, node.id)
              const limited = result?.limitedBy === node.id
              const arrival = climb.indexOf(node.id)
              return (
                <motion.div
                  key={node.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={`bg-card absolute flex flex-col justify-between rounded-xl border px-3 py-2 ${
                    limited && !result?.allowed
                      ? 'border-red-400'
                      : lit.has(node.id)
                        ? 'border-foreground'
                        : 'border-border'
                  }`}
                  style={{
                    left: placed.x - NODE.w / 2,
                    top: placed.y,
                    width: NODE.w,
                    height: NODE.h,
                  }}
                >
                  {pulse && arrival >= 0 && (
                    <span
                      key={pulse.id}
                      className="tree-flash pointer-events-none absolute inset-0 rounded-xl"
                      style={{ animationDelay: `${arrival * LEG_S}s` }}
                    />
                  )}
                  <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
                    <span className="truncate">{node.id}</span>
                    <span className="text-muted-foreground shrink-0 text-[10px]">
                      {isHolder
                        ? 'root · holder'
                        : node.cap != null
                          ? `cap ${n(node.cap)}`
                          : 'inherits'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={used}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{
                          duration: 0.25,
                          ease: EASE,
                          delay: arrival > 0 ? arrival * LEG_S : 0,
                        }}
                        className="tabular-nums"
                      >
                        {n(used)} used
                      </motion.span>
                    </AnimatePresence>
                    <span className="flex gap-1">
                      {tree.holder.features.map((feature) => (
                        <span
                          key={feature}
                          className={`rounded px-1 text-[10px] ${
                            own.includes(feature)
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                              : 'bg-muted text-muted-foreground line-through'
                          }`}
                        >
                          {feature}
                        </span>
                      ))}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {result && (
          <motion.div
            key="check"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: EASE }}
            className={`mx-4 mb-4 flex flex-col gap-2 rounded-xl border p-3 font-mono text-xs ${
              result.allowed
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                : 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span>
                as(&apos;{result.id}&apos;).check(
                {`{ estimate: ${n(result.estimate)} }`})
              </span>
              <span
                className={
                  result.allowed
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-700 dark:text-red-300'
                }
              >
                {result.allowed ? 'allowed' : 'denied'}
              </span>
            </div>
            <div className="text-muted-foreground grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-0.5">
              {result.steps.map((step) => (
                <div key={step.id} className="contents">
                  <span
                    className={
                      step.id === result.limitedBy ? 'text-foreground' : ''
                    }
                  >
                    {step.id}
                  </span>
                  <span>{step.kind}</span>
                  <span
                    className={`text-right tabular-nums ${step.id === result.limitedBy ? 'text-foreground' : ''}`}
                  >
                    {step.remaining === null ? '' : `${n(step.remaining)} left`}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-muted-foreground flex justify-between border-t border-current/10 pt-1.5">
              <span>reason {result.reason}</span>
              <span>limitedBy {result.limitedBy ?? 'null'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
