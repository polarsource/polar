'use client'

import { AnimatePresence, motion } from 'motion/react'
import type { CSSProperties } from 'react'
import type { Line } from './types'

const EASE = [0.2, 0.8, 0.2, 1] as const

/**
 * One file, animated between steps. Lines that carried over keep their key
 * and slide into place; added lines fade in from the left; removed lines
 * collapse. Lines outside the step's focus dim.
 */
export const CodePanel = ({
  lines,
  file = 'void.ts',
}: {
  lines: readonly Line[]
  file?: string
}) => (
  <div className="bg-card border-border flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border">
    <div className="border-border flex items-center gap-2 border-b px-4 py-2.5">
      <span className="bg-border size-2.5 rounded-full" />
      <span className="bg-border size-2.5 rounded-full" />
      <span className="text-muted-foreground ml-2 font-mono text-xs">
        {file}
      </span>
    </div>
    <pre className="code m-0 flex-1 overflow-auto px-4 py-4 font-mono text-[13px] leading-6">
      <AnimatePresence initial={false}>
        {lines.map((line, index) => (
          <motion.div
            key={line.key}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: line.focused ? 1 : 0.3, x: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              duration: 0.3,
              ease: EASE,
              layout: { duration: 0.3, ease: EASE },
            }}
            className="flex"
          >
            <span className="text-muted-foreground w-8 shrink-0 pr-4 text-right tabular-nums opacity-60 select-none">
              {index + 1}
            </span>
            <code className="whitespace-pre">
              {line.tokens.length === 0
                ? ' '
                : line.tokens.map((token, i) => (
                    <span key={i} style={token.style as CSSProperties}>
                      {token.content}
                    </span>
                  ))}
            </code>
          </motion.div>
        ))}
      </AnimatePresence>
    </pre>
  </div>
)
