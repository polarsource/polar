import ArrowDownward from '@mui/icons-material/ArrowDownward'
import { PhyllotaxisSunflower } from './PhyllotaxisSunflower'

export function CoverSection() {
  return (
    <div className="relative flex h-screen w-full flex-col justify-between p-8 md:p-16">
      <div className="flex items-start justify-between">
        <span className="font-medium">Polar Software Inc</span>
        <span className="font-medium">{new Date().getFullYear()}</span>
      </div>
      <div className="absolute inset-0">
        <PhyllotaxisSunflower />
      </div>
      <div className="flex items-end justify-between">
        <h1 className="text-5xl font-light tracking-tight md:text-8xl">
          Brand
          <br />
          Guidelines
        </h1>
        <span className="font-medium">
          <ArrowDownward />
        </span>
      </div>
    </div>
  )
}
