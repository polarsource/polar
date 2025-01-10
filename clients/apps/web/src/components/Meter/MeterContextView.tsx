import { Meter } from '@/app/api/meters/data'
import { MeterDetails } from '@/components/Meter/MeterDetails'
import { AddOutlined } from '@mui/icons-material'
import { useTheme } from 'next-themes'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'

const mockedMeterProducts = [
  {
    id: '123',
    name: 'Pro Tier',
  },
  {
    id: '456',
    name: 'Enterprise Tier',
  },
  {
    id: '789',
    name: 'Free Tier',
  },
]

const mockedMeterAlerts = [
  {
    id: '123',
    name: 'Small beginnings',
    threshold: 100,
    frequency: 'once_per_customer',
  },
  {
    id: '456',
    name: 'To the moon',
    threshold: 1000,
    frequency: 'once_per_customer',
  },
] as const

const frequencyDisplayNames: Record<
  (typeof mockedMeterAlerts)[number]['frequency'],
  string
> = {
  once_per_customer: 'Once per customer',
}

export interface MeterContextViewProps {
  meter: Meter
}

export const MeterContextView = ({ meter }: MeterContextViewProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <div className="flex flex-col gap-y-8 overflow-y-auto px-8 py-12">
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row gap-x-2">
          <h2 className="text-xl">Details</h2>
        </div>
        <MeterDetails meter={meter} />
      </div>
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center justify-between gap-x-4">
          <h3>Metered Products</h3>
        </div>
        <List size="small">
          {mockedMeterProducts.map((product) => (
            <ListItem className="text-sm" key={product.id} size="small">
              {product.name}
            </ListItem>
          ))}
        </List>
      </div>
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center justify-between gap-x-4">
          <h3>Meter Alerts</h3>
          <Button size="sm" className="h-6 w-6 rounded-full">
            <AddOutlined fontSize="inherit" />
          </Button>
        </div>
        <List size="small">
          {mockedMeterAlerts.map((alert) => (
            <ListItem
              className="justify-between text-sm"
              key={alert.id}
              size="small"
            >
              <div className="flex flex-col">
                <span>{alert.name}</span>
                <span className="dark:text-polar-500 text-xs text-gray-500">
                  {frequencyDisplayNames[alert.frequency]}
                </span>
              </div>
              <div className="dark:text-polar-500 flex flex-row items-center gap-x-2 text-gray-500">
                <span className="font-mono text-xs">
                  {Intl.NumberFormat('en-US', {
                    notation: 'standard',
                  }).format(alert.threshold)}
                </span>
                <div className="relative h-8 w-8">
                  <svg
                    className="absolute left-0 top-0 h-full w-full -rotate-90"
                    viewBox="0 0 36 36"
                  >
                    {(meter.value / alert.threshold) * 100 >= 100 && (
                      <circle
                        cx="18"
                        cy="18"
                        r="1"
                        fill={
                          (meter.value / alert.threshold) * 100 >= 100
                            ? 'rgb(52, 211, 153)'
                            : 'rgb(96, 165, 250)'
                        }
                      />
                    )}
                    <circle
                      cx="18"
                      cy="18"
                      r="8"
                      strokeWidth="3"
                      fill="none"
                      stroke={
                        resolvedTheme === 'dark'
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.1)'
                      }
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="8"
                      stroke={
                        (meter.value / alert.threshold) * 100 >= 100
                          ? 'rgb(52, 211, 153)'
                          : 'rgb(96, 165, 250)'
                      }
                      strokeDasharray={`${Math.round((meter.value / alert.threshold) * 100)}, 100`}
                      strokeWidth="3"
                      fill="none"
                    />
                  </svg>
                </div>
              </div>
            </ListItem>
          ))}
        </List>
      </div>
    </div>
  )
}
