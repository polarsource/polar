import ArrowDownward from '@mui/icons-material/ArrowDownward'
import { Headline } from '@polar-sh/orbit'
import { PhyllotaxisSunflower } from './PhyllotaxisSunflower'

export function CoverSection() {
  return (
    <div className="relative flex h-screen w-full flex-col justify-between p-8 md:p-16">
      <div className="flex items-start justify-between">
        <Headline as="span" text="Polar Software Inc" />
        <span className="font-medium">{new Date().getFullYear()}</span>
      </div>
      <div className="absolute inset-0">
        <PhyllotaxisSunflower />
      </div>
      <div className="flex items-end justify-between">
        <Headline
          animate
          as="h1"
          className="tracking-tight"
          text={['Brand', 'Guidelines']}
        />
        <span>
          <ArrowDownward />
        </span>
      </div>
    </div>
  )
}
