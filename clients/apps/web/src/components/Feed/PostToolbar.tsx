import { useAuth } from '@/hooks'
import {
  ChevronDownIcon,
  EnvelopeIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { Article, ArticleUpdateVisibilityEnum } from '@polar-sh/sdk'
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
import { Label } from 'polarkit/components/ui/label'
import { Banner } from 'polarkit/components/ui/molecules'
import { RadioGroup, RadioGroupItem } from 'polarkit/components/ui/radio-group'
import { useSendArticlePreview, useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

interface PostToolbarProps {
  article?: Article
  previewAs: string
  onPreviewAsChange: (value: string) => void
}

export const PostToolbar = ({
  article,
  previewAs,
  onPreviewAsChange,
}: PostToolbarProps) => {
  const {
    isShown: isPreviewEmailModalShown,
    hide: hidePreviewEmailModal,
    show: showPreviewEmailModal,
  } = useModal()
  const {
    isShown: isVisibilityModalShown,
    hide: hideVisibilityModal,
    show: showVisibilityModal,
  } = useModal()

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
          {article && (
            <>
              {!article?.published_at && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="px-1.5"
                  onClick={showVisibilityModal}
                >
                  <EyeIcon className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="px-1.5"
                onClick={showPreviewEmailModal}
              >
                <EnvelopeIcon className="h-4 w-4" />
              </Button>
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
          </DropdownMenu>{' '}
          {article && (
            <>
              <Modal
                isShown={isPreviewEmailModalShown}
                hide={hidePreviewEmailModal}
                modalContent={
                  <PreviewEmailModal
                    article={article}
                    hideModal={hidePreviewEmailModal}
                  />
                }
              />
              {!article?.published_at && (
                <Modal
                  isShown={isVisibilityModalShown}
                  hide={hideVisibilityModal}
                  modalContent={
                    <VisibilityModalContent
                      article={article}
                      hideModal={hideVisibilityModal}
                    />
                  }
                />
              )}
            </>
          )}
        </TabsContent>
      </div>
    </div>
  )
}

interface PreviewEmailModalProps {
  article: Article
  hideModal: () => void
}

const PreviewEmailModal = ({ article, hideModal }: PreviewEmailModalProps) => {
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
      id: article.id,
      email: previewEmail,
    })

    hideModal()
  }, [article, previewEmail, hideModal])

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg">Send Preview Email</h2>
        <p className="dark:text-polar-400  w-2/3 text-sm text-gray-400">
          Sends a preview of the post via email.
        </p>
        {article.visibility === ArticleUpdateVisibilityEnum.PRIVATE ? (
          <Banner color="blue">
            <p>
              Note: This post is currently <em>private</em>. The receiver might
              not have permissions to see the post.
            </p>
          </Banner>
        ) : null}
      </div>
      <div className="flex flex-col gap-y-6">
        <Input type="email" value={previewEmail} />
        <div className="mt-2 flex flex-row items-center gap-x-2">
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

interface VisibilityModalContentProps {
  article: Article
  hideModal: () => void
}

const VisibilityModalContent = ({
  article,
  hideModal,
}: VisibilityModalContentProps) => {
  const [visibility, setVisibility] = useState<ArticleUpdateVisibilityEnum>(
    article.visibility,
  )
  const updateArticle = useUpdateArticle()

  const handleUpdateVisibility = useCallback(async () => {
    await updateArticle.mutateAsync({
      id: article.id,
      articleUpdate: {
        visibility: visibility as ArticleUpdateVisibilityEnum,
      },
    })

    hideModal()
  }, [updateArticle, article, visibility])

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Visibility</h2>
        <p className="dark:text-polar-400 mt-2 text-sm text-gray-400">
          Adjusts the unpublished visibility of the post
        </p>
      </div>
      <div className="flex flex-col gap-y-6">
        <RadioGroup
          value={visibility}
          onValueChange={(v) => setVisibility(v as ArticleUpdateVisibilityEnum)}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value={ArticleUpdateVisibilityEnum.PRIVATE}
              id={ArticleUpdateVisibilityEnum.PRIVATE}
            />
            <Label htmlFor={ArticleUpdateVisibilityEnum.PRIVATE}>
              Organization members
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value={ArticleUpdateVisibilityEnum.HIDDEN}
              id={ArticleUpdateVisibilityEnum.HIDDEN}
            />
            <Label htmlFor={ArticleUpdateVisibilityEnum.HIDDEN}>
              Anyone with the link
            </Label>
          </div>
        </RadioGroup>
        <div className="mt-4 flex flex-row items-center gap-x-2">
          <Button
            className="self-start"
            loading={updateArticle.isPending}
            onClick={handleUpdateVisibility}
          >
            Update
          </Button>
          <Button variant="ghost" className="self-start" onClick={hideModal}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
