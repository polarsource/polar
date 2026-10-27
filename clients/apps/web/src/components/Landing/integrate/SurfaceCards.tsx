import { GraphicCardGrid, type GraphicCardProps } from '../FeatureCards'
import { Compass } from '../graphics/Compass'
import { Dumbbell } from '../graphics/Dumbbell'
import { LinkedRings } from '../graphics/LinkedRings'

const SURFACES: GraphicCardProps[] = [
  {
    title: 'MCP',
    desc: 'Your agent reads and acts on your billing.',
    href: '#mcp',
    Graphic: Compass,
  },
  {
    title: 'SDK',
    desc: 'Typed clients for TypeScript and Python.',
    href: '#sdk',
    Graphic: LinkedRings,
  },
  {
    title: 'CLI',
    desc: 'Webhooks on localhost, events on demand.',
    href: '#cli',
    Graphic: Dumbbell,
  },
]

export const SurfaceCards = () => <GraphicCardGrid cards={SURFACES} />
