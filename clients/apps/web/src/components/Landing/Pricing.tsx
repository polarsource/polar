import CheckOutlined from '@mui/icons-material/CheckOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

// ── Component ─────────────────────────────────────────────────────────────────
export const Pricing = () => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Left — text */}
      <div className="dark:bg-dark-900 col-span-1 flex flex-col gap-y-8 bg-gray-50 p-12 md:col-span-2 md:flex-1">
        <h2 className="font-display text-3xl leading-tight! md:text-5xl">
          Eveything you need
          <br />
          for a flat fee
        </h2>
        <p className="dark:text-polar-500 max-w-xl text-lg leading-relaxed text-pretty text-gray-500">
          One flat rate covers payment processing, global tax compliance, and
          reliable support. No monthly fees, no setup costs.
        </p>

        <div className="flex gap-x-3">
          <Link href="/resources/pricing" target="_blank">
            <Button className="dark:hover:bg-polar-50 rounded-full border-none bg-black hover:bg-neutral-900 dark:bg-white dark:text-black">
              Pricing Guide
            </Button>
          </Link>
        </div>
      </div>

      {/* Right — visual fee breakdown */}
      <div className="dark:bg-dark-900 flex flex-col gap-y-4 bg-gray-50 md:flex-1">
        {/* Fee display */}
        <div className="flex flex-col gap-y-8 p-12">
          <div className="flex flex-col gap-y-4">
            <div className="flex items-baseline gap-x-3">
              <span className="text-5xl font-light tracking-tight">4%</span>
              <span className="dark:text-polar-500 text-2xl text-gray-400">
                + 40¢
              </span>
            </div>
            <span className="dark:text-polar-500 font-mono text-xs tracking-wide text-gray-400 uppercase">
              per transaction
            </span>
          </div>
          <ul className="flex flex-col gap-y-2">
            {[
              'Global tax & VAT compliance included',
              'Fraud protection & chargebacks handled',
              'Volume discounts for high-growth teams',
              'No monthly or setup fees',
            ].map((item) => (
              <li key={item} className="flex gap-x-4">
                <CheckOutlined className="text-emerald-500" fontSize="small" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
