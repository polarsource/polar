import { BenefitSubscriberInner, SubscriptionSubscriber } from '@polar-sh/sdk'

const FilesSubscriberWidget = ({
  benefit,
  subscription,
}: {
  benefit: BenefitSubscriberInner
  subscription: SubscriptionSubscriber
}) => {
  // const campaigns = useAdvertisementCampaigns(subscription.id, benefit.id)

  console.log('benefit', benefit)

  return (
    <div>
      <h1>Download widget goes here</h1>
      <ul>
        {benefit.properties.files.map((fileId) => (
          <li key={fileId}>
            <a>{fileId}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FilesSubscriberWidget
