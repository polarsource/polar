import { useAuth } from '@/hooks'
import { ChevronDownIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import { DropdownMenuItemIndicator } from '@radix-ui/react-dropdown-menu'
import {
  Button,
  Input,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useSendArticlePreview } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

interface PostToolbarProps {
  articleId?: string
  previewAs: string
  onPreviewAsChange: (value: string) => void
}

export const PostToolbar = ({
  articleId,
  previewAs,
  onPreviewAsChange,
}: PostToolbarProps) => {
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  return (
    <div className="dark:border-polar-800 dark:bg-polar-900 sticky top-0 z-20 flex w-full flex-col border-b border-gray-100 bg-white">
      <div className="relative mx-auto flex w-full min-w-0 max-w-screen-xl flex-row items-center justify-between gap-x-4 px-4 py-4 sm:px-6 md:px-8">
        <TabsList className="dark:border-polar-700 relative flex-row dark:border md:flex-row">
          <TabsTrigger value="edit" size="small">
            Markdown
          </TabsTrigger>
          <TabsTrigger value="preview" size="small">
            Preview
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="edit"
          className="absolute right-4 mt-0 flex flex-row items-center gap-x-2 sm:right-6 md:right-8"
        ></TabsContent>
        <TabsContent
          value="preview"
          className="absolute right-4 mt-0 flex flex-row items-center gap-x-2 sm:right-6 md:right-8"
        >
          {articleId && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="px-1.5"
                onClick={showModal}
              >
                <EnvelopeIcon className="h-4 w-4" />
              </Button>
              <Modal
                isShown={isModalShown}
                hide={hideModal}
                modalContent={
                  <PreviewEmailModal
                    articleId={articleId}
                    hideModal={hideModal}
                  />
                }
              />
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="px-2 text-left" size="sm">
                <span>Preview as</span>
                <ChevronDownIcon className="ml-2 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={previewAs}
                onValueChange={onPreviewAsChange}
              >
                <DropdownMenuRadioItem value="premium">
                  <DropdownMenuItemIndicator />
                  Premium Subscriber
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="free">
                  <DropdownMenuItemIndicator />
                  Free Subscriber
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </TabsContent>
      </div>
    </div>
  )
}

interface PreviewEmailModalProps {
  articleId: string
  hideModal: () => void
}

const PreviewEmailModal = ({
  articleId,
  hideModal,
}: PreviewEmailModalProps) => {
  const { currentUser } = useAuth()
  const [previewEmail, setPreviewEmail] = useState<string>('')
  const sendPreviewEmail = useSendArticlePreview()

  useEffect(() => {
    if (currentUser?.email) {
      setPreviewEmail(currentUser.email)
    }
  }, [currentUser])

  const handleSendPreviewEmail = useCallback(async () => {
    await sendPreviewEmail.mutateAsync({
      id: articleId,
      email: previewEmail,
    })

    hideModal()
  }, [articleId, previewEmail, hideModal])

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Send Preview Email</h2>
        <p className="dark:text-polar-400 mt-2 text-sm text-gray-400">
          Sends a preview of the post to the email address below
        </p>
      </div>
      <div className="flex flex-col gap-y-6">
        <Input type="email" value={previewEmail} />
        <div className="mt-4 flex flex-row items-center gap-x-2">
          <Button
            className="self-start"
            loading={sendPreviewEmail.isPending}
            onClick={handleSendPreviewEmail}
          >
            Send
          </Button>
          <Button variant="ghost" className="self-start" onClick={hideModal}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
