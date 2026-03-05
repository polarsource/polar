'use client'

import { useMotionValueEvent, useScroll } from 'framer-motion'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
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
const ZSTEP = 38 // vertical gap between layers (tighter default)
const EXPAND = 20 // z-offset applied to layers above/below the hovered one

// Approximate screen-space positions of each layer's top-right corner.
// Recalculated for ZSTEP=38: each step shifts x+23, y-23 (32/52 * 38 ≈ 23).
const ANCHORS = [
  { x: 341, y: 207 }, // z = 0
  { x: 364, y: 184 }, // z = 38
  { x: 387, y: 161 }, // z = 76
  { x: 410, y: 138 }, // z = 114
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
    index: '03',
    label: 'INVOICING',
    description: 'Generate itemized invoices for each billing period',
    highlight: true,
    rows: [260, 180, 200],
    highlightRow: 0,
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
    index: '01',
    label: 'USAGE EVENTS',
    description: 'Capture API calls, token consumption & custom events',
    highlight: false,
    rows: [220, 170, 195, 140],
    highlightRow: -1,
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

// ── Checkout layer elements ─────────────────────────────────────────────────
const CheckoutElements = ({ z, active }: { z: number; active: boolean }) => {
  const BZ = z + PD + 1
  const W = 160
  const X = PX + (PW - W) / 2 // = 130 — horizontally centered
  const HALF = (W - 16) / 2 // = 72  — expiry + cvv with 16px gap
  const BW = 140
  const BX = PX + (PW - BW) / 2 // = 140
  // Content height: rows(3)+gap(7)+rows(3)+gap(7)+divider(1)+gap(7)+email(5)+gap(9)+card(5)+gap(9)+expiry(5)+gap(11)+button(16) ≈ 88px
  // Vertically center in PH=160: top offset = (160−88)/2 = 36
  const Y0 = PY + 36

  const fieldClass = `transition-colors duration-300 ${
    active
      ? 'bg-blue-200/70 dark:bg-blue-400/40'
      : 'bg-gray-300/50 dark:bg-polar-600/40'
  }`
  const rowClass = `transition-colors duration-300 ${
    active
      ? 'bg-blue-200/50 dark:bg-blue-400/30'
      : 'bg-gray-300/40 dark:bg-polar-600/35'
  }`
  const priceClass = `transition-colors duration-300 ${
    active
      ? 'bg-blue-300/60 dark:bg-blue-400/40'
      : 'bg-gray-400/40 dark:bg-polar-500/40'
  }`
  return (
    <>
      {/* Order summary — line item 1: name stub + price stub */}
      <IsometricBox
        x={X}
        y={Y0}
        z={BZ}
        width={100}
        height={3}
        depth={2}
        topClassName={rowClass}
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      />
      <IsometricBox
        x={X + 134}
        y={Y0}
        z={BZ}
        width={26}
        height={3}
        depth={2}
        topClassName={priceClass}
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      />
      {/* Order summary — line item 2 */}
      <IsometricBox
        x={X}
        y={Y0 + 10}
        z={BZ}
        width={80}
        height={3}
        depth={2}
        topClassName={rowClass}
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      />
      <IsometricBox
        x={X + 134}
        y={Y0 + 10}
        z={BZ}
        width={26}
        height={3}
        depth={2}
        topClassName={priceClass}
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      />
      {/* Divider */}
      <IsometricBox
        x={X}
        y={Y0 + 20}
        z={BZ}
        width={W}
        height={1}
        depth={1}
        topClassName={`transition-colors duration-300 ${
          active
            ? 'bg-blue-200/40 dark:bg-blue-700/30'
            : 'bg-gray-200/60 dark:bg-polar-700/50'
        }`}
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      />
      {/* Email / customer field */}
      <IsometricBox
        x={X}
        y={Y0 + 28}
        z={BZ}
        width={W}
        height={5}
        depth={3}
        topClassName={fieldClass}
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      />
      {/* Card number field */}
      <IsometricBox
        x={X}
        y={Y0 + 42}
        z={BZ}
        width={W}
        height={5}
        depth={3}
        topClassName={fieldClass}
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      />
      {/* Expiry field */}
      <IsometricBox
        x={X}
        y={Y0 + 56}
        z={BZ}
        width={HALF}
        height={5}
        depth={3}
        topClassName={fieldClass}
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      />
      {/* CVV field */}
      <IsometricBox
        x={X + HALF + 16}
        y={Y0 + 56}
        z={BZ}
        width={HALF}
        height={5}
        depth={3}
        topClassName={fieldClass}
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      />
      {/* Pay button */}
      <IsometricBox
        x={BX}
        y={Y0 + 72}
        z={BZ}
        width={BW}
        height={16}
        depth={5}
        topClassName={`transition-colors duration-300 ${
          active
            ? 'bg-blue-400/90 dark:bg-blue-500/80 border-[0.5px] border-blue-300 dark:border-blue-400'
            : 'bg-blue-500/60 dark:bg-blue-600/50 border-[0.5px] border-blue-400/60 dark:border-blue-500/60'
        }`}
        frontClassName={`transition-colors duration-300 ${
          active
            ? 'bg-blue-500/70 dark:bg-blue-600/60'
            : 'bg-blue-600/50 dark:bg-blue-700/40'
        }`}
        rightClassName={`transition-colors duration-300 ${
          active
            ? 'bg-blue-600/60 dark:bg-blue-700/50'
            : 'bg-blue-700/40 dark:bg-blue-800/40'
        }`}
      />
      {/* Button label stub */}
      <IsometricBox
        x={BX + (BW - 60) / 2}
        y={Y0 + 78}
        z={BZ + 6}
        width={60}
        height={2}
        depth={1}
        topClassName="text-[6px] font-mono uppercase text-center tracking-widest text-white"
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      >
        Pay Now
      </IsometricBox>
    </>
  )
}

// ── Plate primitive ────────────────────────────────────────────────────────────
const Plate = ({ layer, hovered }: { layer: LayerDef; hovered: boolean }) => {
  const { z, rows } = layer
  const active = hovered
  return (
    <>
      <IsometricBox
        x={PX}
        y={PY}
        z={z}
        width={PW}
        height={PH}
        depth={PD}
        topClassName={`transition-colors duration-300 ${active ? AT : `${T} ${EDGE}`}`}
        frontClassName={`transition-colors duration-300 ${active ? AF : F}`}
        rightClassName={`transition-colors duration-300 ${active ? AR : R}`}
      />
      {layer.label === 'CHECKOUT' ? (
        <CheckoutElements z={z} active={active} />
      ) : (
        rows.map((w, i) => (
          <IsometricBox
            key={i}
            x={PX + 20}
            y={PY + 20 + i * 28}
            z={z + PD + 1}
            width={w}
            height={3}
            depth={2}
            topClassName={`transition-colors duration-300 ${
              active
                ? 'bg-blue-300/70 dark:bg-blue-400/50'
                : 'bg-gray-400/40 dark:bg-polar-600/50'
            }`}
            frontClassName="bg-transparent"
            rightClassName="bg-transparent"
          />
        ))
      )}
      {/* Outline rectangle — rendered last so it sits above the plate bg via DOM order */}
      <IsometricBox
        x={PX}
        y={PY}
        z={z + PD}
        width={PW + 25}
        height={PH + 25}
        depth={5}
        topClassName={`bg-transparent border transition-colors duration-300 ${
          active
            ? 'border-blue-500/50 dark:border-blue-500/50'
            : 'border-transparent'
        }`}
        frontClassName="bg-transparent"
        rightClassName="bg-transparent"
      />
    </>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────
export const BillingDiagram = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [scrollLayer, setScrollLayer] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevLayerRef = useRef<number | null>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.85', 'end 0.15'],
  })

  useMotionValueEvent(scrollYProgress, 'change', (v: number) => {
    const prev = prevLayerRef.current
    const H = 0.015 // hysteresis — each boundary shifts toward the side we're coming from

    const b1 = 0.375 + (prev === 3 ? H : prev === 2 ? -H : 0)
    const b2 = 0.5 + (prev === 2 ? H : prev === 1 ? -H : 0)
    const b3 = 0.625 + (prev === 1 ? H : prev === 0 ? -H : 0)

    let next: number | null
    if (v < b1) next = 3
    else if (v < b2) next = 2
    else if (v < b3) next = 1
    else next = 0

    if (next !== prev) {
      prevLayerRef.current = next
      setScrollLayer(next)
    }
  })

  // Hover takes priority; scroll-driven state is the fallback
  const activeIndex = hoveredIndex ?? scrollLayer

  return (
    <div
      ref={containerRef}
      className="flex w-full flex-col gap-y-12 md:flex-row md:items-start md:gap-x-16"
    >
      {/* Left — pipeline description */}
      <div className="flex flex-col gap-y-12 md:w-2/5">
        <span className="dark:text-polar-500 font-mono text-[11px] tracking-[0.2em] text-gray-400 uppercase">
          Billing Pipeline
        </span>
        <h2 className="font-display text-3xl leading-tight! text-pretty md:text-5xl">
          Event to invoice.
          <br />
          End-to-end.
        </h2>
        <p className="dark:text-polar-500 text-lg leading-relaxed text-pretty text-gray-500">
          Every API call and token flows through a complete billing pipeline —
          from raw usage events to itemized invoices and hosted checkout.
        </p>
        <ul
          className="grid grid-cols-1 md:grid-cols-2"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {LAYERS.map((layer, i) => [layer, i] as const)
            .reverse()
            .map(([layer, i]) => {
              const active = activeIndex === i
              return (
                <li
                  key={layer.index}
                  className={twMerge(
                    'flex cursor-pointer flex-col gap-y-1 rounded-sm p-4 transition-colors',
                    active ? 'dark:bg-polar-900 bg-gray-100' : '',
                  )}
                  onMouseEnter={() => setHoveredIndex(i)}
                >
                  <span
                    className={`font-mono text-xs font-medium tracking-[0.15em] uppercase transition-colors ${
                      active
                        ? 'text-black dark:text-white'
                        : 'dark:text-polar-200 text-gray-700'
                    }`}
                  >
                    {layer.label}
                  </span>
                  <p className="dark:text-polar-500 text-sm leading-relaxed text-gray-500">
                    {layer.description}
                  </p>
                </li>
              )
            })}
        </ul>
      </div>

      {/* Right — isometric illustration with floating labels */}
      <div
        className="pointer-events-none relative flex-1 overflow-visible"
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
              {/* Shadow floor — single IsometricBox at z=-1, below all plate layers */}
              <IsometricBox
                x={PX - 80}
                y={PY - 80}
                z={-120}
                width={PW}
                height={PH}
                depth={1}
                topClassName="bg-transparent"
                frontClassName="bg-transparent"
                rightClassName="bg-transparent"
              >
                <svg
                  className="dark:text-polar-600 absolute text-gray-300"
                  width={PW}
                  height={PH}
                >
                  <defs>
                    <pattern
                      id="billing-diagram-dots"
                      x="0"
                      y="0"
                      width="16"
                      height="16"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx="8" cy="8" r="1" fill="currentColor" />
                    </pattern>
                  </defs>
                  <rect
                    x="0"
                    y="0"
                    width={PW + 40}
                    height={PH + 40}
                    fill="url(#billing-diagram-dots)"
                  />
                </svg>
              </IsometricBox>

              {LAYERS.map((layer, i) => {
                const zOffset =
                  activeIndex === null
                    ? 0
                    : i < activeIndex
                      ? -EXPAND
                      : i === activeIndex
                        ? 0
                        : EXPAND
                return (
                  <div
                    key={layer.z}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      transformStyle: 'preserve-3d',
                      transform: `translateZ(${zOffset}px)`,
                      transition:
                        'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <Plate layer={layer} hovered={activeIndex === i} />
                  </div>
                )
              })}
            </Isometric>

            {/* Floating annotation labels */}
            {LAYERS.map((layer, i) => {
              const active = activeIndex === i
              return (
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
                    className={`font-mono text-[10px] tracking-[0.15em] uppercase transition-colors ${
                      active
                        ? 'font-medium text-blue-500'
                        : 'dark:text-polar-500 text-gray-400'
                    }`}
                  >
                    {layer.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
