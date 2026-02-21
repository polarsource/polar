import { BarChart, Box, Headline } from '@/components/Orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

const props = [
  {
    name: 'data',
    type: 'BarChartItem[]',
    default: '—',
    desc: 'Array of { label, value } objects. Values are relative to each other.',
  },
  {
    name: 'animated',
    type: 'boolean',
    default: 'false',
    desc: 'Enables scaleY bar animation and opacity fade on viewport entry.',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Classes applied to the root flex container.',
  },
]

export default function BarChartPage() {
  return (
    <Box display="flex" flexDirection="column" className="gap-20">
      <OrbitPageHeader
        label="Component"
        title="BarChart"
        description="A comparative data visualization with proportional bars. Bar heights are relative to the highest value and always fill the container. Colors are dynamically computed from a neutral lightness curve, adapting automatically to light and dark mode."
      />

      {/* Demo */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Demo" />
        <Box className="h-96">
          <BarChart
            animated
            data={[
              { label: 'Checkout Conversion', value: 42 },
              { label: 'Retained Subscriptions', value: 59 },
              { label: 'Customer Satisfaction', value: 81 },
            ]}
          />
        </Box>
      </Box>

      {/* Behavior notes */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Behavior" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {[
            {
              heading: 'Relative scaling',
              content:
                'Bar heights are always relative to the highest value in the dataset. The tallest bar fills the container height; all others scale proportionally.',
            },
            {
              heading: 'Minimum floor',
              content:
                'Even a value of 0 renders its bar at minimum content height — enough to show the label and value. The floor is measured via a ghost element using the same typography.',
            },
            {
              heading: 'Color curve',
              content:
                'Background lightness follows a quadratic curve: in light mode, high values trend toward dark; in dark mode, high values trend toward light. The lightness range is 8–90% (light) and 10–85% (dark) to avoid pure extremes.',
            },
            {
              heading: 'Text contrast',
              content:
                'Text color flips between near-white and near-black at the 45% lightness threshold to maintain readability against any bar color.',
            },
          ].map(({ heading, content }) => (
            <Box key={heading} className="grid grid-cols-5 gap-8 py-6">
              <Box className="col-span-2">
                <Headline as="h6" text={heading} />
              </Box>
              <p className="dark:text-polar-400 col-span-3 text-sm leading-relaxed text-neutral-600">
                {content}
              </p>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Props */}
      <Box display="flex" flexDirection="column" gap={3}>
        <OrbitSectionHeader title="Props" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {props.map(({ name, type, default: def, desc }) => (
            <Box key={name} className="grid grid-cols-5 gap-4 py-4">
              <code className="dark:text-polar-200 col-span-1 font-mono text-sm text-neutral-800">
                {name}
              </code>
              <code className="dark:text-polar-400 col-span-2 font-mono text-xs text-neutral-500">
                {type}
              </code>
              <code className="dark:text-polar-500 font-mono text-xs text-neutral-400">
                {def}
              </code>
              <span className="dark:text-polar-400 text-xs text-neutral-500">
                {desc}
              </span>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
