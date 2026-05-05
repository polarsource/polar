import ArrowDownward from '@mui/icons-material/ArrowDownward'
import { Text } from '@polar-sh/orbit'
import { PhyllotaxisSunflower } from './PhyllotaxisSunflower'

export function CoverSection() {
  return (
    <div className="relative flex h-screen w-full flex-col justify-between p-8 md:p-16">
      <div className="flex items-start justify-between">
        <Text as="span" variant="heading-xxs">
          Polar Software Inc
        </Text>
        <span className="font-medium">{new Date().getFullYear()}</span>
      </div>
      <div className="absolute inset-0">
        <PhyllotaxisSunflower />
      </div>
      <div className="flex items-end justify-between">
        <Text as="h1" variant="heading-xl">
          Brand
          <br />
          Guidelines
        </Text>
        <span>
          <ArrowDownward />
        </span>
      </div>
    </div>
  )
}
