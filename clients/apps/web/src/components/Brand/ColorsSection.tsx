import { SectionLayout } from './SectionLayout'

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function ColorCell({
  name,
  hex,
  className = '',
  textLight,
}: {
  name: string
  hex: string
  className?: string
  textLight?: boolean
}) {
  const [r, g, b] = hexToRgb(hex)
  const text = textLight ? 'text-neutral-400' : 'text-neutral-600'

  return (
    <div
      className={`flex flex-col justify-end p-5 ${className}`}
      style={{ backgroundColor: hex }}
    >
      <span className={`text-xs font-medium ${text}`}>{name}</span>
      <div className={`mt-1 flex gap-3 text-xs ${text}`}>
        <span>
          <span className="font-medium">HEX</span>&ensp;{hex}
        </span>
      </div>
      <div className={`flex gap-3 text-xs ${text}`}>
        <span>
          <span className="font-medium">R</span> {r}
        </span>
        <span>
          <span className="font-medium">G</span> {g}
        </span>
        <span>
          <span className="font-medium">B</span> {b}
        </span>
      </div>
    </div>
  )
}

function GradientCell({
  name,
  from,
  to,
}: {
  name: string
  from: string
  to: string
}) {
  return (
    <div
      className="flex flex-col justify-end p-5"
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      <span className="text-xs font-medium text-neutral-400">
        {name}&ensp;{from}&ensp;{to}
      </span>
    </div>
  )
}

export function ColorsSection() {
  return (
    <SectionLayout label="Color Palette">
      <div className="flex flex-col gap-10">
        <div className="flex max-w-md flex-col gap-3">
          <h3 className="text-sm font-semibold">Color Palette</h3>
          <p className="text-sm leading-relaxed text-neutral-500">
            The palette is predominantly greyscale: black and white define the
            space, with sparing use of grey tones in typography and UI. This
            contrast sharpens focus and highlights core content, while keeping
            visual noise to a minimum.
          </p>
        </div>

        <div className="grid grid-cols-1 grid-rows-[1fr_auto_auto] overflow-hidden border border-neutral-200 sm:grid-cols-3">
          {/* Row 1 — tall swatches */}
          <ColorCell name="White" hex="#FFFFFF" className="min-h-72" />
          <ColorCell name="Ash" hex="#999999" className="min-h-72" />
          <ColorCell
            name="Black"
            hex="#000000"
            className="min-h-72"
            textLight
          />

          {/* Row 2 */}
          <ColorCell name="Mist" hex="#F2F2F2" />
          <ColorCell name="Slate" hex="#666666" textLight />
          <GradientCell name="Gradient 01" from="#262626" to="#303030" />

          {/* Row 3 */}
          <ColorCell name="Stone" hex="#D9D9D9" />
          <ColorCell name="Charcoal" hex="#404040" textLight />
          <GradientCell name="Gradient 02" from="#000000" to="#1F1F1F" />
        </div>
      </div>
    </SectionLayout>
  )
}
