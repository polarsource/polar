import { DownloadableRead } from '@polar-sh/sdk'

import { useDownloadables } from '@/hooks/queries'

const DownloadableItem = ({
  downloadable,
}: {
  downloadable: DownloadableRead
}) => {
  return (
    <a
      onClick={(e) => {
        e.preventDefault()
        window.location.href = downloadable.file.download.url
      }}
      className="text-blue-500 underline"
    >
      {downloadable.file.name} ({downloadable.file.size} bytes)
    </a>
  )
}

const DownloadablesSubscriberWidget = ({
  benefit,
}: {
  benefit: BenefitDownloadablesSubscriber
}) => {
  const downloadablesQuery = useDownloadables(benefit.properties.files)

  const downloadables: DownloadableRead[] = downloadablesQuery.data?.items

  if (downloadablesQuery.isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  return (
    <div>
      <ul>
        {downloadables.map((downloadable) => (
          <li key={downloadable.id}>
            <DownloadableItem downloadable={downloadable} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DownloadablesSubscriberWidget
