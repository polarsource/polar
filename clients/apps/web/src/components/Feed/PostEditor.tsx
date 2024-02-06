import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { Article } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ShadowBoxOnMd,
  TabsContent,
} from 'polarkit/components/ui/atoms'
import { useSubscriptionBenefits } from 'polarkit/hooks'
import React, { PropsWithChildren, useContext, useState } from 'react'
import { DashboardBody } from '../Layout/DashboardLayout'
import { MarkdownEditor } from '../Markdown/MarkdownEditor'
import { StaggerReveal } from '../Shared/StaggerReveal'
import LongformPost from './LongformPost'
import { PublishSettings } from './Publishing/PublishSettings'
import { PostToolbar } from './Toolbar/PostToolbar'
import {
  useMarkdownComponents,
  youtubeIdFromURL,
} from './Toolbar/useMarkdownComponents'
import { EditorHelpers, useEditorHelpers } from './useEditorHelpers'

const defaultPostEditorContext: EditorHelpers = {
  bodyRef: { current: null },
  titleRef: { current: null },
  insertTextAtCursor: (text: string) => {},
  wrapSelectionWithText: ([before, after]: [string, string]) => {},
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {},
  handleDrag: (e: React.DragEvent<HTMLTextAreaElement>) => {},
  handleDragOver: (e: React.DragEvent<HTMLTextAreaElement>) => {},
  handleDrop: (e: React.DragEvent<HTMLTextAreaElement>) => {},
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {},
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => {},
}

export const PostEditorContext = React.createContext(defaultPostEditorContext)

type PostEditorContextProviderProps = PropsWithChildren<{
  onChange: (value: string) => void
}>

const PostEditorContextProvider = ({
  onChange,
  children,
}: PostEditorContextProviderProps) => {
  const helpers = useEditorHelpers(onChange)

  return (
    <PostEditorContext.Provider value={helpers}>
      {children}
    </PostEditorContext.Provider>
  )
}

interface PostEditorProps {
  article?: Article
  title: string
  body: string
  onTitleChange: (title: string) => void
  onBodyChange: (body: string) => void
  previewProps: React.ComponentProps<typeof LongformPost>
  disabled?: boolean
  canCreate?: boolean
}

export const PostEditor = ({
  article,
  title,
  body,
  onTitleChange,
  onBodyChange,
  previewProps,
  disabled,
  canCreate,
}: PostEditorProps) => {
  const [previewAs, setPreviewAs] = useState<string>('premium')
  const { org } = useCurrentOrgAndRepoFromURL()

  if (!org) {
    return null
  }

  return (
    <PostEditorContextProvider onChange={onBodyChange}>
      <PostToolbar
        article={article}
        previewAs={previewAs}
        onPreviewAsChange={setPreviewAs}
        canCreate={canCreate}
      />
      <div>
        <DashboardBody className="mt-0 !p-0">
          <div className="flex flex-row">
            <div className="flex w-full flex-col px-4 pb-6 sm:px-6 md:px-8">
              <TabsContent className="flex-grow" value="edit" tabIndex={-1}>
                <Editor
                  title={title}
                  body={body}
                  onTitleChange={onTitleChange}
                  disabled={disabled}
                />
              </TabsContent>
              <TabsContent value="preview">
                <StaggerReveal className="dark:md:bg-polar-900 dark:md:border-polar-800 dark:ring-polar-800 relative my-8 flex min-h-screen w-full flex-col items-center rounded-[3rem] ring-1 ring-gray-100 dark:ring-1 md:bg-white md:p-12 md:shadow-sm dark:md:border">
                  <LongformPost
                    {...previewProps}
                    animation={false}
                    revealTransition={{ duration: 0 }}
                    staggerTransition={{ staggerChildren: 0 }}
                    showPaywalledContent={previewAs === 'premium'}
                    isSubscriber={previewAs === 'premium'}
                    hasPaidArticlesBenefit={previewAs === 'premium'}
                    showShare={false}
                  />
                </StaggerReveal>
              </TabsContent>
              <TabsContent
                value="settings"
                className="flex flex-col gap-16 md:mt-8 md:flex-row md:items-start md:justify-between"
              >
                {article && <PublishSettings article={article} />}
              </TabsContent>
            </div>
          </div>
        </DashboardBody>
      </div>
    </PostEditorContextProvider>
  )
}

type EditorProps = Pick<
  PostEditorProps,
  'title' | 'body' | 'onTitleChange' | 'disabled'
>

const Editor = ({ title, body, onTitleChange, disabled }: EditorProps) => {
  const { titleRef, bodyRef, insertTextAtCursor } =
    useContext(PostEditorContext)

  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move focus to body
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      if (bodyRef.current) {
        e.preventDefault()
        bodyRef.current.focus()
      }
    }
  }

  return (
    <div className="relative z-[1] flex flex-row md:gap-x-4 lg:gap-x-8">
      <div className="flex flex-1 flex-col gap-y-8 py-8">
        <input
          className="transparent dark:placeholder:text-polar-500 min-w-full border-none bg-transparent text-3xl font-medium shadow-none outline-none"
          autoFocus
          placeholder="Title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={disabled}
          ref={titleRef}
          onKeyDown={onTitleKeyDown}
        />
        <MarkdownEditor
          className="focus:ring-none rounded-none border-none bg-transparent p-0 shadow-none outline-none focus:ring-transparent focus-visible:ring-transparent dark:bg-transparent dark:shadow-none dark:outline-none dark:focus:ring-transparent"
          value={body}
          disabled={disabled}
        />
      </div>
      <Sidebar />
    </div>
  )
}

const Sidebar = () => {
  const { insertPaywall, insertSubscribeNow, insertAd } =
    useMarkdownComponents()

  const { org } = useCurrentOrgAndRepoFromURL()

  const benefits = useSubscriptionBenefits(org?.name)
  const benefitItems = benefits.data?.items ?? []
  const adBenefits = benefitItems.filter((b) => b.type === 'ads')

  const [selectedAdBenefit, setSelectedAdBenefit] = useState<string>()

  return (
    <div>
      <div className="sticky top-24 hidden w-full min-w-[250px] max-w-xs flex-col gap-y-4 lg:flex">
        <ShadowBoxOnMd className="dark:border-polar-800 w-full !shadow-2xl dark:border md:p-8">
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-2">
              <div className="flex flex-col gap-y-2">
                <h3 className="font-medium">Components</h3>
                <Button
                  variant={'outline'}
                  size={'sm'}
                  fullWidth={true}
                  onClick={insertPaywall}
                >
                  <span className="whitespace-nowrap text-center">Paywall</span>
                </Button>

                <Button
                  variant={'outline'}
                  size={'sm'}
                  fullWidth={true}
                  onClick={insertSubscribeNow}
                >
                  <span className="flex-1 whitespace-nowrap text-center">
                    Subscribe Now
                  </span>
                </Button>
              </div>
            </div>

            {benefits.isFetched ? (
              <>
                <div className="flex flex-col gap-y-2">
                  <h3 className="font-medium">Ad</h3>

                  {adBenefits.length > 0 ? (
                    <>
                      <Select onValueChange={setSelectedAdBenefit}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select benefit" />
                        </SelectTrigger>
                        <SelectContent>
                          {adBenefits.map((b) => (
                            <SelectItem value={b.id} key={b.id}>
                              {b.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant={'outline'}
                        size={'sm'}
                        disabled={!selectedAdBenefit}
                        onClick={() => {
                          insertAd(
                            selectedAdBenefit ?? 'INSERT_BENEFIT_ID_HERE',
                          )
                        }}
                      >
                        Add
                      </Button>
                    </>
                  ) : (
                    <p className="dark:text-polar-400 text-sm text-gray-600">
                      Setup your first ad{' '}
                      <Link
                        href={`/maintainer/${org?.name}/subscriptions/tiers`}
                        className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        subscription benefit
                      </Link>{' '}
                      to enable ads.
                    </p>
                  )}
                </div>
              </>
            ) : null}

            <SidebarYouTube />
          </div>
        </ShadowBoxOnMd>
      </div>
    </div>
  )
}

const SidebarYouTube = () => {
  const [url, setURL] = useState('')
  const { insertYouTube } = useMarkdownComponents()

  const validURL = Boolean(youtubeIdFromURL(url))

  return (
    <div className="flex flex-col gap-y-2">
      <h3 className="font-medium">YouTube</h3>

      <Input
        placeholder="Video URL"
        value={url}
        onChange={(e) => setURL(e.target.value)}
      />
      <Button
        variant={'outline'}
        size={'sm'}
        onClick={() => {
          insertYouTube(url)
        }}
        disabled={!validURL}
      >
        Add
      </Button>
    </div>
  )
}
