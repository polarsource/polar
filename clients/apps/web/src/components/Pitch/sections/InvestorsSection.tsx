import { Link } from '../Link'

export const InvestorsSection = () => {
  return (
    <div className="flex flex-col gap-y-16 md:flex-row md:gap-x-32">
      <div className="flex max-w-lg flex-col gap-y-8">
        <h1 className="text-lg">06. Investors</h1>
        <h1 className="text-4xl">Our Angels</h1>
        <p>
          What used to be a simple way to pay for things has become a complex
          mess.
        </p>
        <p>
          Software as a Service (SaaS) has become the norm, but the underlying
          payment infrastructure has not evolved.
        </p>
        <p>
          This is why we are building Polar 2.0, payment infrastructure for the
          21st century.
        </p>
        <Link href="/pitch/what">Why →</Link>
      </div>
    </div>
  )
}
