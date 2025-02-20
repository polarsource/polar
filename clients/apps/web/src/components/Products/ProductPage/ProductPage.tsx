import { useMetrics } from '@/hooks/queries'
import { dateToInterval } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { useMemo } from 'react'
import { DashboardBody } from '../../Layout/DashboardLayout'
import { ProductThumbnail } from '../ProductThumbnail'
import { ProductMetricsView } from './ProductMetricsView'
import { ProductOverview } from './ProductOverview'
import { ProductPageContextView } from './ProductPageContextView'

const ProductTypeDisplayColor: Record<string, string> = {
  subscription: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
  one_time: 'bg-blue-100 text-blue-400 dark:bg-blue-950',
}

export interface ProductPageProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductPage = ({ organization, product }: ProductPageProps) => {
  const interval = useMemo(
    () => dateToInterval(new Date(product.created_at)),
    [product.created_at],
  )
  const { data: metrics, isLoading: metricsLoading } = useMetrics({
    organization_id: organization.id,
    product_id: [product.id],
    interval,
    startDate: new Date(product.created_at),
    endDate: new Date(),
  })
  const { data: todayMetrics } = useMetrics({
    organization_id: organization.id,
    startDate: new Date(),
    endDate: new Date(),
    interval: 'day',
    product_id: [product.id],
  })

  return (
    <Tabs defaultValue="overview" className="h-full">
      <DashboardBody
        title={
          <div className="flex flex-row items-center gap-6">
            <div className="flex flex-row items-center gap-4">
              <ProductThumbnail product={product} />
              <h1 className="text-2xl">{product.name}</h1>
            </div>
            <Status
              status={
                product.is_recurring ? 'Subscription' : 'One-time Product'
              }
              className={
                ProductTypeDisplayColor[
                  product.is_recurring ? 'subscription' : 'one_time'
                ]
              }
            />
          </div>
        }
        contextViewClassName="hidden md:block"
        contextView={
          <ProductPageContextView
            organization={organization}
            product={product}
          />
        }
        wide
      >
        <TabsList className="pb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <ProductOverview
            metrics={metrics}
            todayMetrics={todayMetrics}
            organization={organization}
            product={product}
          />
        </TabsContent>
        <TabsContent value="metrics">
          <ProductMetricsView
            metrics={metrics?.metrics}
            periods={metrics?.periods}
            interval={interval}
            loading={metricsLoading}
          />
        </TabsContent>
      </DashboardBody>
    </Tabs>
  )
}
