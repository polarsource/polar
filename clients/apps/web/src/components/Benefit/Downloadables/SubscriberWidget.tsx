import { BenefitDownloadablesSubscriber, DownloadableRead } from '@polar-sh/sdk'

import { useDownloadables } from '@/hooks/queries'

const DownloadableItem = ({
  downloadable,
  historic,
}: {
  downloadable: DownloadableRead
  historic: boolean
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
      {historic && ' (Historic)'}
    </a>
  )
}

const DownloadablesSubscriberWidget = ({
  benefit,
}: {
  benefit: BenefitDownloadablesSubscriber
}) => {
  const downloadablesQuery = useDownloadables(
    benefit.id,
    benefit.properties.active_files,
  )

  let activeLookup: { [key: string]: boolean } = {}
  benefit.properties.active_files.reduce((acc, fileId: string) => {
    acc[fileId] = true
    return acc
  }, activeLookup)

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
            <DownloadableItem
              downloadable={downloadable}
              historic={!activeLookup[downloadable.file.id]}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DownloadablesSubscriberWidget
