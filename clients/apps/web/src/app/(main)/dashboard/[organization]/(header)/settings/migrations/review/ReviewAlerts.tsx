import { Alert } from '@polar-sh/orbit'
import { CATALOG_READ_STALLED } from '../catalogReadCopy'
import { CATALOG_REFRESH_COPY } from './reviewCatalog'

export function ReviewAlerts({
  rerunning,
  stalled,
  refreshError,
  importError,
  paymentMethodSummary,
}: {
  rerunning: boolean
  stalled: boolean
  refreshError?: string
  importError?: string
  paymentMethodSummary?: string | null
}) {
  return (
    <>
      {rerunning && !refreshError && (
        <Alert
          variant="info"
          loading
          title={CATALOG_REFRESH_COPY.title}
          description={
            stalled ? CATALOG_READ_STALLED : CATALOG_REFRESH_COPY.description
          }
        />
      )}
      {refreshError && (
        <Alert
          variant="danger"
          title="We couldn't refresh your catalog"
          description={refreshError}
        />
      )}
      {importError && (
        <Alert
          variant="danger"
          title="We couldn't prepare these subscriptions"
          description={importError}
        />
      )}
      {paymentMethodSummary && (
        <Alert
          variant="warning"
          title="Some payment methods won't carry over"
          description={paymentMethodSummary}
        />
      )}
    </>
  )
}
