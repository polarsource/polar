import { Platforms } from '@polar-sh/sdk'
import { api } from 'polarkit/api'
import { Button } from 'polarkit/components/ui/atoms'
import { useRef, useState } from 'react'
import { ModalHeader } from '../Modal'

const ImportSubscribersModal = ({ hide }: { hide: () => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setFile] = useState<File>()

  const onUpload = async () => {
    if (!selectedFile) {
      return
    }

    // const formData = new FormData()

    // formData.append("upload.csv", )

    console.log('doing upload', selectedFile)

    const res = await api.subscriptions.subscriptionsImport({
      organizationName: 'zegl',
      platform: Platforms.GITHUB,
      file: selectedFile,
    })

    console.log(res)
  }

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={hide}>
        <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
          Import subscribers
        </h3>
      </ModalHeader>
      <div className="overflow-scroll p-8">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <span className="font-medium">Import from CSV</span>
            <p className="text-polar-500 dark:text-polar-500 text-sm">
              Import your subscribers from other platforms (Substack, Patreon,
              etc)
            </p>
          </div>
          <input
            type="file"
            className=""
            ref={fileInputRef}
            accept=".csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0])
              } else {
                setFile(undefined)
              }
            }}
          />

          <Button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.click()
              }
            }}
          >
            Select file
          </Button>

          <Button
            disabled={selectedFile === undefined}
            onClick={() => onUpload()}
          >
            Import {selectedFile ? selectedFile.name : null}
          </Button>
        </div>
      </div>
    </>
  )
}

export default ImportSubscribersModal
