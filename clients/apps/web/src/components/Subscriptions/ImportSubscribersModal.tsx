import { api, queryClient } from '@/utils/api'
import { Organization } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Banner } from 'polarkit/components/ui/molecules'
import { useRef, useState } from 'react'
import { ModalHeader } from '../Modal'

const ImportSubscribersModal = ({
  hide,
  organization,
}: {
  hide: () => void
  organization: Organization
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setFile] = useState<File>()

  const [addedSubscribers, setAddedSubscribers] = useState<number>()
  const [isLoading, setIsLoading] = useState(false)

  const onUpload = async () => {
    if (!selectedFile) {
      return
    }

    setIsLoading(true)

    await api.subscriptions
      .import({
        organizationId: organization.id,
        file: selectedFile,
      })
      .then((res) => {
        setAddedSubscribers(res.count)
        queryClient.invalidateQueries({
          queryKey: ['subscriptions'],
        })
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={hide}>
        <h3 className="text-lg font-medium text-gray-950 dark:text-white">
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
            className="hidden"
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

          <div className="flex gap-2">
            <Button
              disabled={isLoading}
              variant={'secondary'}
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
              loading={isLoading}
              onClick={() => onUpload()}
            >
              Import {selectedFile ? selectedFile.name : null}
            </Button>
          </div>

          {addedSubscribers !== undefined ? (
            <Banner color="blue">
              Imported {addedSubscribers}{' '}
              {addedSubscribers === 1 ? 'subscriber' : 'subscribers'}
            </Banner>
          ) : null}
        </div>
      </div>
    </>
  )
}

export default ImportSubscribersModal
