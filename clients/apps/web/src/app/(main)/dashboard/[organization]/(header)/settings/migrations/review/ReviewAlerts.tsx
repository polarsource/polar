import { Alert } from '@polar-sh/orbit'
import { CATALOG_READ_STALLED } from '../catalogReadCopy'
import { CATALOG_REFRESH_COPY } from './reviewCatalog'

export function ReviewAlerts({
  rerunning,
  stalled,
  refreshError,
  importError,
}: {
  rerunning: boolean
  stalled: boolean
  refreshError?: string
  importError?: string
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
          title="We couldn't refresh from Stripe"
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
    </>
  )
}
