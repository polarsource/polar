import { schemas } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { PortalRow } from './PortalPrimitives'

const DateValue = ({ datetime }: { datetime: string }) => (
  <FormattedDateTime datetime={datetime} dateStyle="medium" resolution="day" />
)

export const SubscriptionDateRows = ({
  subscription,
}: {
  subscription: schemas['CustomerSubscription']
}) => {
  const isPaused = subscription.status === 'paused'
  const isTrialing =
    subscription.status === 'trialing' && !!subscription.trial_end

  return (
    <>
      {subscription.started_at && (
        <PortalRow
          label="Started"
          value={<DateValue datetime={subscription.started_at} />}
        />
      )}
      {isTrialing && subscription.trial_end ? (
        <PortalRow
          label="Trial ends"
          value={<DateValue datetime={subscription.trial_end} />}
        />
      ) : (
        !subscription.ended_at &&
        !isPaused &&
        subscription.current_period_end && (
          <PortalRow
            label={
              subscription.cancel_at_period_end
                ? 'Ends on'
                : subscription.pause_at_period_end
                  ? 'Pauses on'
                  : 'Renews on'
            }
            value={<DateValue datetime={subscription.current_period_end} />}
          />
        )
      )}
      {isPaused && subscription.paused_at && (
        <PortalRow
          label="Paused on"
          value={<DateValue datetime={subscription.paused_at} />}
        />
      )}
      {(isPaused || subscription.pause_at_period_end) && (
        <PortalRow
          label="Resumes on"
          value={
            subscription.resumes_at ? (
              <DateValue datetime={subscription.resumes_at} />
            ) : (
              'Until resumed'
            )
          }
        />
      )}
      {subscription.ended_at && (
        <PortalRow
          label="Ended on"
          value={<DateValue datetime={subscription.ended_at} />}
        />
      )}
    </>
  )
}

export const PendingUpdateRows = ({
  subscription,
  products,
}: {
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
}) => {
  const pendingUpdate = subscription.pending_update
  if (!pendingUpdate) {
    return null
  }
  const pendingProduct = products.find(
    (product) => product.id === pendingUpdate.product_id,
  )

  return (
    <>
      {pendingProduct && (
        <PortalRow
          label="New plan"
          value={`${subscription.product.name} → ${pendingProduct.name}`}
        />
      )}
      {pendingUpdate.seats !== null && (
        <PortalRow
          label="Seats"
          value={`${subscription.seats} → ${pendingUpdate.seats}`}
        />
      )}
      {pendingUpdate.units !== null && (
        <PortalRow
          label="Units"
          value={`${subscription.units} → ${pendingUpdate.units}`}
        />
      )}
      <PortalRow
        label="Takes effect"
        value={<DateValue datetime={pendingUpdate.applies_at} />}
      />
    </>
  )
}
