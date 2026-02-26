import { BarChart, Headline, Stack, Text } from '@polar-sh/orbit'
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
    <Stack vertical gap={10}>
      <OrbitPageHeader
        label="Component"
        title="BarChart"
        description="A comparative data visualization with proportional bars. Bar heights are relative to the highest value and always fill the container. Colors are dynamically computed from a neutral lightness curve, adapting automatically to light and dark mode."
      />

      {/* Demo */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Demo" />
        <div className="h-96">
          <BarChart
            animated
            data={[
              { label: 'Checkout Conversion', value: 42 },
              { label: 'Retained Subscriptions', value: 59 },
              { label: 'Customer Satisfaction', value: 81 },
            ]}
          />
        </div>
      </Stack>

      {/* Behavior notes */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Behavior" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
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
            <div key={heading} className="grid grid-cols-5 gap-8 py-6">
              <div className="col-span-2">
                <Headline as="h6" text={heading} />
              </div>
              <Text variant="subtle" className="col-span-3">
                {content}
              </Text>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* Props */}
      <Stack vertical gap={3}>
        <OrbitSectionHeader title="Props" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
          {props.map(({ name, type, default: def, desc }) => (
            <div key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" variant="mono" className="col-span-1">
                {name}
              </Text>
              <Text as="code" variant="mono" className="col-span-2">
                {type}
              </Text>
              <Text as="code" variant="mono">
                {def}
              </Text>
              <Text variant="caption">
                {desc}
              </Text>
            </div>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
