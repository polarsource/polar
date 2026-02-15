import {
  PhyllotaxisSunflower,
  generatePhyllotaxis,
} from './PhyllotaxisSunflower'
import { SectionLayout } from './SectionLayout'

export function LogoSection() {
  return (
    <SectionLayout
      label="02 / Logo"
      footer={
        <div className="flex items-center gap-8 text-xs text-neutral-400">
          <span>Minimum size: 24px</span>
          <span>Clear space: 1x height</span>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-12">
        <div className="flex items-center gap-16">
          <div className="flex h-40 w-40 items-center justify-center rounded-3xl border border-neutral-200">
            <PhyllotaxisSunflower size={100} />
          </div>
          <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-black">
            <svg
              width={100}
              height={100}
              viewBox="0 0 100 100"
              className="max-w-full"
            >
              {generatePhyllotaxis(300, 100 / 37.5, 50, 50)
                .filter((dot) => {
                  const dx = dot.x - 50
                  const dy = dot.y - 50
                  return Math.sqrt(dx * dx + dy * dy) <= 30
                })
                .map((dot, i) => (
                  <circle
                    key={i}
                    cx={dot.x}
                    cy={dot.y}
                    r={dot.r}
                    fill="white"
                  />
                ))}
            </svg>
          </div>
        </div>
        <p className="max-w-md text-center text-sm leading-relaxed text-neutral-400">
          The Polar logomark is a phyllotaxis pattern representing organic
          growth and mathematical precision. Use it with generous clear space.
        </p>
      </div>
    </SectionLayout>
  )
}
