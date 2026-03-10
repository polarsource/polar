const SEGMENTS = 128

// Each slot is 8 units wide: 7px segment + 1px gap
const SLOT = 8
const SEG_W = 2

export const SegmentedBar = ({ progress }: { progress: number }) => {
  const filled = Math.round(progress * SEGMENTS)
  const viewW = SEGMENTS * SLOT - 1 // no trailing gap

  return (
    <svg
      viewBox={`0 0 ${viewW} 8`}
      className="w-full"
      style={{ height: 8 }}
      preserveAspectRatio="none"
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <rect
          key={i}
          x={i * SLOT}
          y={0}
          width={SEG_W}
          height={8}
          className={
            i < filled
              ? 'fill-black dark:fill-white'
              : 'dark:fill-polar-700 fill-gray-200'
          }
        />
      ))}
    </svg>
  )
}
