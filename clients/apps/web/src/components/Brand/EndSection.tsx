import { PhyllotaxisSunflower } from './PhyllotaxisSunflower'

export function EndSection() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-16">
      <PhyllotaxisSunflower size={200} />
      <h2 className="text-3xl tracking-tight">Thank you</h2>
      <p className="text-sm text-neutral-500">
        For questions, reach out to brand@polar.sh
      </p>
    </div>
  )
}
