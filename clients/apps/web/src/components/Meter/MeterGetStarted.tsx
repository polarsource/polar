import { Meter } from '@/app/api/meters/data'

export interface MeterGetStartedProps {
  meter: Meter
}

export const MeterGetStarted = ({ meter }: MeterGetStartedProps) => {
  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-gray-100 p-6">
      <h2 className="text-lg font-semibold">Get started with metering</h2>
      <p>Meter usage by sending meter events to the Polar API.</p>
      <pre className="dark:bg-polar-900 rounded-lg bg-white p-4 font-mono text-sm">
        <code>{`curl https://api.polar.sh/v1/billing/meter_events \\
-u "sk_test_...:gHzA" \\
-d slug=${meter.slug} \\
-d "payload[customer_id]"="{{ CUSTOMER_ID }}" \\
-d "payload[value]"=1`}</code>
      </pre>
    </div>
  )
}
