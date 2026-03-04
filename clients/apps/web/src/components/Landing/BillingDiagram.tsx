'use client'

import { Isometric, IsometricBox } from './Isometric'

// ── Colors (same system as Features.tsx) ──────────────────────────────────────
const T = 'bg-gray-100 dark:bg-polar-950'
const F = 'bg-gray-200 dark:bg-polar-900'
const R = 'bg-gray-300 dark:bg-polar-950'
const EDGE = 'border-[0.5px] border-gray-200 dark:border-polar-700'

// Blue accent — invoicing layer
const AT =
  'bg-blue-50 dark:bg-blue-950/60 border-[0.5px] border-blue-200 dark:border-blue-800/50'
const AF = 'bg-blue-100 dark:bg-blue-900/40'
const AR = 'bg-blue-200/70 dark:bg-blue-950/60'

// ── Scene geometry ─────────────────────────────────────────────────────────────
const SW = 420 // scene width
const SH = 280 // scene height

// Plate: centered in scene (PX + PW/2 = SW/2 = 210, PY + PH/2 = SH/2 = 140)
const PW = 280 // plate width
const PH = 160 // plate height (Y depth)
const PD = 6 // plate thickness
const PX = 70
const PY = 60
const ZSTEP = 52 // vertical gap between layers

// Approximate screen-space positions of each layer's top-right corner within
// the Isometric container, derived from rotateX(60deg) rotateZ(45deg) math.
// Used to anchor the floating annotation labels.
const ANCHORS = [
  { x: 341, y: 207 }, // z = 0
  { x: 373, y: 175 }, // z = 52
  { x: 405, y: 143 }, // z = 104
  { x: 437, y: 111 }, // z = 156
]

// ── Layer data ─────────────────────────────────────────────────────────────────
type LayerDef = {
  z: number
  index: string
  label: string
  description: string
  highlight: boolean
  rows: number[]
  highlightRow: number
}

const LAYERS: LayerDef[] = [
  {
    z: 0 * ZSTEP,
    index: '01',
    label: 'USAGE EVENTS',
    description: 'Capture API calls, token consumption & custom events',
    highlight: false,
    rows: [220, 170, 195, 140],
    highlightRow: -1,
  },
  {
    z: 1 * ZSTEP,
    index: '02',
    label: 'METERING',
    description: 'Aggregate usage, enforce rate limits & quotas per customer',
    highlight: false,
    rows: [200, 160, 180],
    highlightRow: -1,
  },
  {
    z: 2 * ZSTEP,
    index: '03',
    label: 'INVOICING',
    description: 'Generate itemized invoices for each billing period',
    highlight: true,
    rows: [260, 180, 200],
    highlightRow: 0,
  },
  {
    z: 3 * ZSTEP,
    index: '04',
    label: 'CHECKOUT',
    description: 'Hosted payment, customer portal & subscription management',
    highlight: false,
    rows: [210, 165],
    highlightRow: -1,
  },
]

// ── Plate primitive ────────────────────────────────────────────────────────────
const Plate = ({ layer }: { layer: LayerDef }) => {
  const { z, highlight, rows, highlightRow } = layer
  return (
    <>
      <IsometricBox
        x={PX}
        y={PY}
        z={z}
        width={PW}
        height={PH}
        depth={PD}
        topClassName={highlight ? AT : `${T} ${EDGE}`}
        frontClassName={highlight ? AF : F}
        rightClassName={highlight ? AR : R}
      />
      {rows.map((w, i) => (
        <IsometricBox
          key={i}
          x={PX + 20}
          y={PY + 20 + i * 28}
          z={z + PD + 1}
          width={w}
          height={3}
          depth={2}
          topClassName={
            i === highlightRow
              ? 'bg-blue-300/70 dark:bg-blue-400/50'
              : 'bg-gray-400/40 dark:bg-polar-600/50'
          }
          frontClassName="bg-transparent"
          rightClassName="bg-transparent"
        />
      ))}
    </>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────
export const BillingDiagram = () => (
  <div className="flex w-full flex-col gap-y-12 md:flex-row md:items-start md:gap-x-16">
    {/* Left — pipeline description */}
    <div className="flex flex-col gap-y-8 md:w-2/5">
      <span className="dark:text-polar-500 font-mono text-[11px] tracking-[0.2em] text-gray-400 uppercase">
        Billing Pipeline
      </span>
      <h2 className="text-3xl leading-snug text-pretty md:text-4xl">
        Event to invoice,
        <br />
        end-to-end
      </h2>
      <p className="dark:text-polar-500 text-lg leading-relaxed text-pretty text-gray-500">
        Every API call and token flows through a complete billing pipeline —
        from raw usage events to itemized invoices and hosted checkout.
      </p>
      <ul className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {LAYERS.map((layer) => (
          <li key={layer.index} className="flex flex-col gap-y-1">
            <div className="flex items-baseline gap-x-3">
              <span
                className={
                  layer.highlight
                    ? 'font-mono text-xs font-medium tracking-[0.15em] text-blue-500 uppercase'
                    : 'dark:text-polar-200 font-mono text-xs font-medium tracking-[0.15em] text-gray-700 uppercase'
                }
              >
                {layer.label}
              </span>
            </div>
            <p className="dark:text-polar-500 text-sm leading-relaxed text-gray-500">
              {layer.description}
            </p>
          </li>
        ))}
      </ul>
    </div>

    {/* Right — isometric illustration with floating labels */}
    <div
      className="relative flex-1 overflow-visible"
      style={{ minHeight: 510 }}
    >
      {/* Illustration, centered and shifted down to prevent top overflow */}
      <div className="absolute inset-0 flex justify-center overflow-visible">
        <div
          style={{
            transform: 'scale(1.35)',
            transformOrigin: 'top center',
            marginTop: 120,
            position: 'relative',
            overflow: 'visible',
          }}
        >
          <Isometric style={{ width: SW, height: SH }}>
            {LAYERS.map((layer) => (
              <Plate key={layer.z} layer={layer} />
            ))}
          </Isometric>

          {/* Floating annotation labels */}
          {LAYERS.map((layer, i) => (
            <div
              key={layer.index}
              className="absolute hidden items-center gap-x-2 whitespace-nowrap md:flex"
              style={{
                top: ANCHORS[i].y - 8,
                left: ANCHORS[i].x + 14,
              }}
            >
              <div className="dark:bg-polar-600 h-px w-5 bg-gray-300" />
              <span
                className={
                  layer.highlight
                    ? 'font-mono text-[10px] font-medium tracking-[0.15em] text-blue-500 uppercase'
                    : 'dark:text-polar-500 font-mono text-[10px] tracking-[0.15em] text-gray-400 uppercase'
                }
              >
                {layer.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)
