import { MetricType } from '@polar-sh/sdk'
import { Chart } from '../Chart'
import { Link } from '../Link'

export const UsageBasedSection = () => {
  return (
    <div className="flex flex-row gap-x-32">
      <div className="flex max-w-lg flex-col gap-y-8">
        <h1 className="text-lg">01. Usage Based</h1>
        <h1 className="text-4xl">The future of payments is usage based</h1>
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
      <Chart
        data={[
          ...(() => {
            const getLastMonthValues = () => {
              const values = []
              for (let i = 31; i >= 0; i--) {
                values.push({
                  timestamp: new Date(
                    new Date().setDate(new Date().getDate() - i),
                  ),
                  value: Math.floor(Math.random() * 500),
                })
              }
              return values
            }

            return getLastMonthValues()
          })(),
        ]}
        interval="day"
        metric={{
          slug: 'value',
          display_name: 'Value',
          type: MetricType.SCALAR,
        }}
      />
    </div>
  )
}
