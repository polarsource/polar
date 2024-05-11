import { api } from '@/utils/api'
import { BenefitSubscriberInner, SubscriptionSubscriber } from '@polar-sh/sdk'

const FilesSubscriberWidget = ({
  benefit,
  subscription,
}: {
  benefit: BenefitSubscriberInner
  subscription: SubscriptionSubscriber
}) => {
  const onDownload = async (fileId: string) => {
    const response = await api.files.getFile({
      fileId: fileId,
    })
    console.log('response', response)
    if (response.url) {
      window.location = response.url
    }
  }

  return (
    <div>
      <h1>Download widget goes here</h1>
      <ul>
        {benefit.properties.files.map((fileId) => (
          <li key={fileId}>
            <a
              onClick={(e) => {
                e.preventDefault()
                onDownload(fileId)
              }}
              className="text-blue-500 underline"
            >
              {fileId}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FilesSubscriberWidget
