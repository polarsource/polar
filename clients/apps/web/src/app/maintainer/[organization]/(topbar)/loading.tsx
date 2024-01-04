import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Skeleton } from 'polarkit/components/ui/skeleton'

export default function Loading() {
  return (
    <DashboardBody>
      <div className="flex flex-col gap-2 p-8">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </DashboardBody>
  )
}
