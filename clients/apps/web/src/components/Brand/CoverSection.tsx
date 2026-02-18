import ArrowDownward from '@mui/icons-material/ArrowDownward'
import { PhyllotaxisSunflower } from './PhyllotaxisSunflower'

export function CoverSection() {
  return (
    <div className="flex h-screen w-full flex-col justify-between p-16">
      <div className="flex items-start justify-between">
        <span className="font-medium">Polar Software Inc</span>
        <span className="font-medium">{new Date().getFullYear()}</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <PhyllotaxisSunflower size={800} />
      </div>
      <div className="flex items-end justify-between">
        <h1 className="text-8xl font-light tracking-tight">
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
