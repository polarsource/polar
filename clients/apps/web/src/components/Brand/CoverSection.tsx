import ArrowForward from '@mui/icons-material/ArrowForward'
import { PhyllotaxisSunflower } from './PhyllotaxisSunflower'

export function CoverSection() {
  return (
    <div className="flex h-full w-full flex-col justify-between p-16">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium">Polar Software Inc</span>
        <span className="text-sm font-medium">2025</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <PhyllotaxisSunflower size={400} />
      </div>
      <div className="flex items-end justify-between">
        <h1 className="text-5xl tracking-tight">
          Brand
          <br />
          Guidelines
        </h1>
        <span className="text-sm font-medium">
          <ArrowForward />
        </span>
      </div>
    </div>
  )
}
