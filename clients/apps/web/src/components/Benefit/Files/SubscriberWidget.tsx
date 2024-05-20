import { BenefitFilesSubscriber, FileSubscriberRead } from '@polar-sh/sdk'

import { useSubscriberAccessibleFiles } from '@/hooks/queries'

const FileItem = ({ file }: { file: BenefitFilesSubscriber }) => {
  return (
    <a
      onClick={(e) => {
        e.preventDefault()
        window.location.href = file.url
      }}
      className="text-blue-500 underline"
    >
      {file.name} ({file.size} bytes)
    </a>
  )
}

const FilesSubscriberWidget = ({
  benefit,
}: {
  benefit: BenefitFilesSubscriber
}) => {
  const fileQuery = useSubscriberAccessibleFiles()

  const files: FileSubscriberRead[] = fileQuery.data?.items

  if (fileQuery.isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  return (
    <div>
      <ul>
        {files.map((file) => (
          <li key={file.id}>
            <FileItem file={file} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FilesSubscriberWidget
