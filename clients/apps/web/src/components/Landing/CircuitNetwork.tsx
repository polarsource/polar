'use client'

import { motion } from 'framer-motion'
import { Isometric, IsometricBox } from './Isometric'

// ── Scene ───────────────────────────────────────────────────────────────────
const SW = 520
const SH = 320
const CS = 30 // standard chip footprint

// ── Central hub geometry ─────────────────────────────────────────────────────
const HUB_CX = 295
const HUB_CY = 160

// Three stacked layers give the hub a tiered tower appearance
const HUB_PLATFORM = { x: HUB_CX - 36, y: HUB_CY - 36, z: 0,  w: 72, h: 72, d: 5  }
const HUB_BODY     = { x: HUB_CX - 20, y: HUB_CY - 20, z: 5,  w: 40, h: 40, d: 22 }
const HUB_CAP      = { x: HUB_CX - 11, y: HUB_CY - 11, z: 27, w: 22, h: 22, d: 8  }

// ── Standard nodes (hub excluded) ────────────────────────────────────────────
type ChipNode = {
  id: string
  cx: number
  cy: number
  depth: number
  primary: boolean
}

const NODES: ChipNode[] = [
  { id: 'api',     cx: 55,  cy: 65,  depth: 10, primary: false },
  { id: 'sdk',     cx: 55,  cy: 160, depth: 10, primary: false },
  { id: 'events',  cx: 55,  cy: 255, depth: 10, primary: false },
  { id: 'agg',     cx: 175, cy: 110, depth: 16, primary: false },
  { id: 'reduce',  cx: 175, cy: 210, depth: 16, primary: false },
  // hub rendered separately
  { id: 'meter',   cx: 405, cy: 100, depth: 14, primary: false },
  { id: 'rate',    cx: 405, cy: 220, depth: 14, primary: false },
  { id: 'invoice', cx: 480, cy: 130, depth: 20, primary: true  },
  { id: 'pay',     cx: 480, cy: 195, depth: 12, primary: false },
]

// ── Traces (Manhattan routing) ───────────────────────────────────────────────
type Trace = { d: string; len: number; delay: number }

const TRACES: Trace[] = [
  { d: 'M 55,65   H 175 V 110', len: 165, delay: 0.0  }, // api    → agg
  { d: 'M 55,160  H 175 V 110', len: 170, delay: 0.5  }, // sdk    → agg
  { d: 'M 55,160  H 175 V 210', len: 170, delay: 1.0  }, // sdk    → reduce
  { d: 'M 55,255  H 175 V 210', len: 165, delay: 1.5  }, // events → reduce
  { d: 'M 175,110 H 295 V 160', len: 170, delay: 0.25 }, // agg    → hub
  { d: 'M 175,210 H 295 V 160', len: 170, delay: 1.25 }, // reduce → hub
  { d: 'M 295,160 V 100 H 405', len: 170, delay: 0.55 }, // hub    → meter
  { d: 'M 295,160 V 220 H 405', len: 170, delay: 1.55 }, // hub    → rate
  { d: 'M 405,100 H 480 V 130', len: 105, delay: 0.85 }, // meter  → invoice
  { d: 'M 405,220 H 480 V 195', len: 100, delay: 1.85 }, // rate   → pay
]

const VIAS = [
  { x: 175, y: 65  }, { x: 175, y: 160 }, { x: 175, y: 255 },
  { x: 295, y: 110 }, { x: 295, y: 100 },
  { x: 295, y: 210 }, { x: 295, y: 220 },
  { x: 480, y: 100 }, { x: 480, y: 220 },
]

// ── Colors ───────────────────────────────────────────────────────────────────
const CHIP_TOP   = 'bg-gray-100 dark:bg-polar-900 border-[0.5px] border-gray-300 dark:border-polar-700'
const CHIP_FRONT = 'bg-gray-200 dark:bg-polar-800'
const CHIP_RIGHT = 'bg-gray-300 dark:bg-polar-900'

const OUT_TOP   = 'bg-blue-50 dark:bg-blue-950/60 border-[0.5px] border-blue-200 dark:border-blue-800/50'
const OUT_FRONT = 'bg-blue-100 dark:bg-blue-900/40'
const OUT_RIGHT = 'bg-blue-200/70 dark:bg-blue-950/60'

const PACKET_EASE: [number, number, number, number] = [0.4, 0, 0.6, 1]

// ── Component ────────────────────────────────────────────────────────────────
export const CircuitNetwork = () => (
  <motion.div
    className="relative flex-1 overflow-visible"
    style={{ minHeight: 460 }}
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
    transition={{ duration: 1.2, delay: 0.2 }}
    viewport={{ once: true }}
  >
    <div className="absolute inset-0 flex items-center justify-center overflow-visible">
      <div
        style={{
          transform: 'scale(1.1)',
          transformOrigin: 'center',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <Isometric style={{ width: SW, height: SH }}>

          {/* ── Board SVG ── */}
          <svg
            className="absolute inset-0"
            width={SW}
            height={SH}
            style={{ overflow: 'visible' }}
          >
            <defs>
              <pattern id="circuit-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="0" cy="0" r="0.85"
                  fill="currentColor"
                  className="text-gray-300 dark:text-polar-800"
                />
              </pattern>
            </defs>

            {/* Dot grid */}
            <rect width={SW} height={SH} fill="url(#circuit-dots)" />

            {/* Static base traces */}
            {TRACES.map((t, i) => (
              <path
                key={`base-${i}`}
                d={t.d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
                className="text-gray-300 dark:text-polar-700"
              />
            ))}

            {/* Animated signal packets */}
            {TRACES.map((t, i) => (
              <motion.path
                key={`pkt-${i}`}
                d={t.d}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ strokeDasharray: `6 ${t.len + 6}` }}
                animate={{ strokeDashoffset: [0, -(t.len + 12)] }}
                transition={{
                  duration: t.len / 75,
                  repeat: Infinity,
                  ease: PACKET_EASE,
                  delay: t.delay,
                }}
              />
            ))}

            {/* Pad circles at node centers */}
            {NODES.map((n) => (
              <circle
                key={`pad-${n.id}`}
                cx={n.cx} cy={n.cy} r="4.5"
                fill="currentColor"
                className={n.primary
                  ? 'text-blue-400 dark:text-blue-500'
                  : 'text-gray-400 dark:text-polar-600'
                }
              />
            ))}

            {/* Hub pad — larger, distinct */}
            <circle cx={HUB_CX} cy={HUB_CY} r="7"
              fill="currentColor"
              className="text-blue-500 dark:text-blue-400"
            />

            {/* Pulse rings on invoice (output primary) */}
            {NODES.filter((n) => n.primary).flatMap((n) =>
              [0, 0.9].map((ringDelay) => (
                <motion.circle
                  key={`ring-${n.id}-${ringDelay}`}
                  cx={n.cx} cy={n.cy} r="5"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  animate={{ scale: [1, 2.6], opacity: [0.6, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: ringDelay }}
                />
              ))
            )}

            {/* Via / junction dots */}
            {VIAS.map((v, i) => (
              <motion.circle
                key={`via-${i}`}
                cx={v.x} cy={v.y} r="2.5"
                fill="currentColor"
                className="text-gray-400 dark:text-polar-600"
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{
                  duration: 2.4 + (i % 3) * 0.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.18,
                }}
              />
            ))}
          </svg>

          {/* ── Standard chip nodes ── */}
          {NODES.map((n) => (
            <IsometricBox
              key={n.id}
              x={n.cx - CS / 2}
              y={n.cy - CS / 2}
              z={0}
              width={CS}
              height={CS}
              depth={n.depth}
              topClassName={n.primary ? OUT_TOP   : CHIP_TOP}
              frontClassName={n.primary ? OUT_FRONT : CHIP_FRONT}
              rightClassName={n.primary ? OUT_RIGHT : CHIP_RIGHT}
            />
          ))}

          {/* ── Central hub — tiered tower ── */}

          {/* Layer 1: wide platform base */}
          <IsometricBox
            x={HUB_PLATFORM.x} y={HUB_PLATFORM.y} z={HUB_PLATFORM.z}
            width={HUB_PLATFORM.w} height={HUB_PLATFORM.h} depth={HUB_PLATFORM.d}
            topClassName="bg-blue-50/80 dark:bg-blue-950/50 border-[0.5px] border-blue-200/60 dark:border-blue-900/60"
            frontClassName="bg-blue-50/60 dark:bg-blue-950/30"
            rightClassName="bg-blue-100/50 dark:bg-blue-950/40"
          />
          {/* Layer 2: main body */}
          <IsometricBox
            x={HUB_BODY.x} y={HUB_BODY.y} z={HUB_BODY.z}
            width={HUB_BODY.w} height={HUB_BODY.h} depth={HUB_BODY.d}
            topClassName="bg-blue-100 dark:bg-blue-900/70 border-[0.5px] border-blue-300/80 dark:border-blue-700/70"
            frontClassName="bg-blue-200/80 dark:bg-blue-900/50"
            rightClassName="bg-blue-300/60 dark:bg-blue-950/60"
          />
          {/* Layer 3: top cap */}
          <IsometricBox
            x={HUB_CAP.x} y={HUB_CAP.y} z={HUB_CAP.z}
            width={HUB_CAP.w} height={HUB_CAP.h} depth={HUB_CAP.d}
            topClassName="bg-blue-300/90 dark:bg-blue-700/80 border-[0.5px] border-blue-400/80 dark:border-blue-500/60"
            frontClassName="bg-blue-400/70 dark:bg-blue-800/60"
            rightClassName="bg-blue-500/50 dark:bg-blue-900/60"
          />

        </Isometric>
      </div>
    </div>
  </motion.div>
)
