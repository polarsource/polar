import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { Article } from '@polar-sh/sdk'
import { TabsContent } from 'polarkit/components/ui/atoms'
import React, { PropsWithChildren, useState } from 'react'
import { DashboardBody } from '../Layout/DashboardLayout'
import { MarkdownEditor } from '../Markdown/MarkdownEditor'
import { StaggerReveal } from '../Shared/StaggerReveal'
import LongformPost from './LongformPost'
import { PostToolbar } from './Toolbar/PostToolbar'
import { EditorHelpers, useEditorHelpers } from './useEditorHelpers'

const defaultPostEditorContext: EditorHelpers = {
  ref: { current: null },
  insertText: (text: string) => {},
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
}

export const PostEditor = ({
  article,
  title,
  body,
  onTitleChange,
  onBodyChange,
  previewProps,
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
      />
      <div className="dark:bg-polar-950 h-full bg-white">
        <DashboardBody className="mt-0 h-full">
          <div className="flex h-full flex-row">
            <div className="flex h-full w-full flex-col">
              <TabsContent className="flex-grow" value="edit" tabIndex={-1}>
                <div className="flex h-full flex-col gap-y-8 py-8">
                  <input
                    className="transparent dark:placeholder:text-polar-500 min-w-full border-none bg-transparent text-3xl font-medium shadow-none outline-none"
                    autoFocus
                    placeholder="Title"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                  />
                  <MarkdownEditor
                    className="focus:ring-none h-full overflow-visible rounded-none border-none bg-transparent p-0 shadow-none outline-none focus:ring-transparent focus-visible:ring-transparent dark:bg-transparent dark:shadow-none dark:outline-none dark:focus:ring-transparent"
                    value={body}
                  />
                </div>
              </TabsContent>
              <TabsContent value="preview">
                <StaggerReveal className="dark:md:bg-polar-900 dark:md:border-polar-800 relative my-8 flex h-full min-h-screen w-full flex-col items-center rounded-[3rem] md:bg-white md:p-12 md:shadow-xl dark:md:border">
                  <LongformPost
                    {...previewProps}
                    revealTransition={{ duration: 0 }}
                    staggerTransition={{ staggerChildren: 0 }}
                    showPaywalledContent={previewAs === 'premium'}
                  />
                </StaggerReveal>
              </TabsContent>
            </div>
          </div>
        </DashboardBody>
      </div>
    </PostEditorContextProvider>
  )
}
