'use client'

import { AnimatePresence, motion } from 'motion/react'
import { short } from './hash'

const EASE = [0.2, 0.8, 0.2, 1] as const

export interface Version {
  readonly label: string
  readonly hash: string
  readonly status: 'draft' | 'active' | 'archived'
}

/** A scenario: a patch pinned to one version, drawn on a lane beside the trunk. */
export interface Branch {
  readonly name: string
  readonly base: string
  readonly hash: string
  readonly changes: number
  readonly promotedAs?: string
}

const W = 420
const TRUNK_X = 150
const LANE_X = 280
const LABEL_X = TRUNK_X - 18
const TOP = 40
const GAP = 112
const R = 8

/** A horizontal S-curve between two nodes. */
const curve = (x0: number, y0: number, x1: number, y1: number) =>
  `M ${x0} ${y0} C ${x0 + 90} ${y0}, ${x1 - 90} ${y1}, ${x1} ${y1}`

const NODE: Record<Version['status'], string> = {
  draft: 'fill-card stroke-muted-foreground',
  active: 'fill-emerald-500 stroke-emerald-400',
  archived: 'fill-border stroke-border',
}

const STATUS: Record<Version['status'], string> = {
  draft: 'fill-muted-foreground',
  active: 'fill-emerald-700 dark:fill-emerald-300',
  archived: 'fill-muted-foreground',
}

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.35, ease: EASE },
}

const draw = {
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.6, ease: EASE },
}

/**
 * The organization's versions as a trunk, newest on top, with the scenario
 * on a lane to the right, joined to its base by a dashed curve. Promoting it
 * draws a second curve back into the trunk. Every version label has a fixed
 * slot, so nodes never move; only what exists changes between steps.
 */
export const Lineage = ({
  slots,
  versions,
  branch,
}: {
  /** Every label the chapter will show, top to bottom. */
  slots: readonly string[]
  versions: readonly Version[]
  branch?: Branch
}) => {
  const yOf = (label: string) => TOP + slots.indexOf(label) * GAP
  const height = TOP + (slots.length - 1) * GAP + 36
  const ys = versions.map((v) => yOf(v.label))
  const base = branch && versions.find((v) => v.hash === branch.base)
  const baseY = base ? yOf(base.label) : 0
  const laneY = baseY - GAP / 2
  const promoted =
    branch?.promotedAs && versions.find((v) => v.label === branch.promotedAs)

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="xMidYMin meet"
      className="h-full w-full font-mono"
      role="img"
      aria-label="Version lineage with a scenario branched off one version"
    >
      <motion.line
        x1={TRUNK_X}
        x2={TRUNK_X}
        initial={false}
        animate={{ y1: Math.min(...ys), y2: Math.max(...ys) }}
        transition={{ duration: 0.4, ease: EASE }}
        className="stroke-border"
        strokeWidth={2}
      />

      <AnimatePresence initial={false}>
        {base && branch && (
          <motion.path
            key={`out:${branch.base}`}
            d={curve(TRUNK_X, baseY, LANE_X, laneY)}
            className="stroke-muted-foreground"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="none"
            {...draw}
          />
        )}
        {promoted && branch && (
          <motion.path
            key={`in:${promoted.hash}`}
            d={curve(LANE_X, laneY, TRUNK_X, yOf(promoted.label))}
            className="stroke-foreground"
            strokeWidth={1.5}
            fill="none"
            {...draw}
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {versions.map((version) => {
          const y = yOf(version.label)
          return (
            <motion.g key={version.hash} {...fade}>
              <motion.circle
                cx={TRUNK_X}
                cy={y}
                r={R}
                strokeWidth={2}
                initial={false}
                animate={{ opacity: 1 }}
                className={`transition-colors duration-300 ${NODE[version.status]}`}
              />
              <text
                x={LABEL_X}
                y={y - 2}
                textAnchor="end"
                className={`text-[11px] ${
                  version.status === 'archived'
                    ? 'fill-muted-foreground'
                    : 'fill-foreground'
                }`}
                textDecoration={
                  version.status === 'archived' ? 'line-through' : undefined
                }
              >
                {version.label}
              </text>
              <text
                x={LABEL_X}
                y={y + 12}
                textAnchor="end"
                className={`text-[10px] ${STATUS[version.status]}`}
              >
                {version.status}
              </text>
              <text
                x={LABEL_X}
                y={y + 25}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {short(version.hash)}
              </text>
            </motion.g>
          )
        })}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {base && branch && (
          <motion.g key={`branch:${branch.name}`} {...fade}>
            <circle
              cx={LANE_X}
              cy={laneY}
              r={R}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              className="fill-card stroke-foreground"
            />
            <text
              x={LANE_X + 20}
              y={laneY - 2}
              className="fill-foreground text-[11px]"
            >
              {branch.name}
            </text>
            <text
              x={LANE_X + 20}
              y={laneY + 12}
              className="fill-muted-foreground text-[10px]"
            >
              {short(branch.hash)}
            </text>
            <AnimatePresence mode="wait" initial={false}>
              <motion.text
                key={branch.promotedAs ?? branch.changes}
                x={LANE_X + 20}
                y={laneY + 26}
                className={`text-[10px] ${
                  branch.promotedAs
                    ? 'fill-foreground'
                    : branch.changes > 0
                      ? 'fill-amber-600 dark:fill-amber-400'
                      : 'fill-muted-foreground'
                }`}
                {...fade}
              >
                {branch.promotedAs
                  ? `promoted as ${branch.promotedAs}`
                  : branch.changes === 0
                    ? 'same as base · scenario'
                    : `${branch.changes} levers changed · scenario`}
              </motion.text>
            </AnimatePresence>
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  )
}
