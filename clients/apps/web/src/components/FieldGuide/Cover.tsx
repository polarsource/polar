import { Plate } from './Plate'
import { RequestAccess } from './RequestAccess'
import { cover } from './pages/cover'

/** The cover: the title, the line under it and the way in, set in HTML beside the mark, which draws itself. */
export function Cover() {
  return (
    <div className="flex flex-col gap-12 md:gap-20">
      <div className="flex justify-between border-b border-dotted border-[#4a4a4a] pb-3 font-mono text-[11px] tracking-[0.04em] text-[#7b7b7b]">
        <span>POLAR · 2026</span>
        <span>FIELD GUIDE</span>
      </div>
      <div className="flex flex-col gap-16 md:flex-row md:items-center md:justify-between md:gap-12">
        <div className="flex flex-col items-start gap-8">
          <h1 className="m-0 text-[40px] leading-[1.1] font-medium tracking-[-0.01em] text-[#d8d8d8] md:text-[56px]">
            Agent-first Billing
            <br />
            <span className="text-[#7b7b7b]">A Field Guide</span>
          </h1>
          <p className="m-0 max-w-[440px] text-[20px] leading-[1.35] font-[450] text-[#7b7b7b]">
            How we’re building the most ambitious metering and billing engine
            for AI software.
          </p>
          <RequestAccess />
        </div>
        <div className="w-full md:w-1/2 md:max-w-[560px]">
          <Plate piece={cover} pace={2.4} />
        </div>
      </div>
    </div>
  )
}
