import { MetricType } from '@polar-sh/sdk'
import { Chart } from '../Chart'
import { Link } from '../Link'
import { Section } from '../Section'

export const UsageBasedSection = () => {
  return (
    <Section
      header={{ index: '01', name: 'Usage Based Future' }}
      title="The future of payments is usage based"
      context={
        <Chart
          data={[
            ...(() => {
              const getLastMonthValues = () => {
                const values = []
                for (let i = 0; i <= 31; i++) {
                  values.push({
                    timestamp: new Date(
                      new Date().setDate(new Date().getDate() + i),
                    ),
                    value: Math.floor(Math.exp(i / 5)), // Exponential growth
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
      }
    >
      <p>
        In a world where Artificial Intelligence is becoming more and more
        prevalent, the intelligence we consume will be charged based on usage.
        It's time for payment infrastructure, built for the 21st century.
      </p>
      <p>
        We believe that the future of payments is usage based, and we are
        committed to build the gold standard for adapters that sits in between
        artificial intelligence and the world.
      </p>
      <Link href="/pitch/what">Why →</Link>
    </Section>
  )
}
