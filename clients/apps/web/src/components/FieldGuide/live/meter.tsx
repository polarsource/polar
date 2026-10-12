import { MONO } from '../sheet'
import { LINE, MID, HAIR } from '../kit'
import { num, useSim } from '../simulation'

/**
 * The meter page, running: each event travels its strand into the fold and out along the line to the dial, and
 * the needle sits where the fold has got to. `fg-travel` is the keyframe the reader defines.
 */
export function LiveMeter({
  x0,
  xm,
  fy,
  n,
  gauge,
}: {
  x0: number
  xm: number
  fy: number
  n: number
  gauge: [number, number]
}) {
  const sim = useSim((s) => s)
  const recent = sim.events.slice(-5)
  const reading = sim.usage['tokens.out']
  const frac = 1 - Math.exp(-reading / 40000)
  const deg = frac * 180
  const strand = (i: number) => {
    const y = 190 + ((fy - 190) * 2 * i) / (n - 1)
    return `M ${x0} ${y} C ${x0 + (xm - x0) * 0.75} ${y}, ${x0 + (xm - x0) * 0.25} ${fy}, ${xm} ${fy} L ${gauge[0] - 30} ${fy}`
  }
  return (
    <g data-live>
      {recent.map((e) => (
        <circle
          key={e.id}
          r={2.2}
          fill={LINE}
          style={{
            offsetPath: `path("${strand(e.n % n)}")`,
            offsetRotate: '0deg',
            animation: 'fg-travel 1100ms cubic-bezier(0.3, 0, 0.2, 1) both',
          }}
        />
      ))}
      <g
        style={{
          transform: `rotate(${deg}deg)`,
          transformOrigin: `${gauge[0]}px ${gauge[1]}px`,
          transition: 'transform 900ms cubic-bezier(0.2, 0.7, 0.2, 1)',
        }}
      >
        <line
          x1={gauge[0]}
          y1={gauge[1]}
          x2={gauge[0] - 24}
          y2={gauge[1]}
          stroke={LINE}
          strokeWidth={HAIR}
        />
      </g>
      <circle cx={gauge[0]} cy={gauge[1]} r={2} fill={LINE} />
      <text
        x={gauge[0]}
        y={gauge[1] + 16}
        fontSize={8}
        fill={MID}
        textAnchor="middle"
        style={MONO}
      >
        {num(reading)} tokens.out
      </text>
    </g>
  )
}
