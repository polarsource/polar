import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { TabsContent } from 'polarkit/components/ui/atoms'
import { DashboardBody } from '../Layout/DashboardLayout'
import { MarkdownEditor } from '../Markdown/MarkdownEditor'
import { StaggerReveal } from '../Shared/StaggerReveal'
import LongformPost from './LongformPost'
import { PostToolbar } from './PostToolbar'

interface PostEditorProps {
  title: string
  body: string
  onTitleChange: (title: string) => void
  onBodyChange: (body: string) => void
  previewProps: React.ComponentProps<typeof LongformPost>
}

export const PostEditor = ({
  title,
  body,
  onTitleChange,
  onBodyChange,
  previewProps,
}: PostEditorProps) => {
  const { org } = useCurrentOrgAndRepoFromURL()

  if (!org) {
    return null
  }

  return (
    <>
      <PostToolbar />
      <div className="dark:bg-polar-950 h-full bg-white pt-24">
        <DashboardBody className="h-full">
          <div className="flex h-full flex-row">
            <div className="flex h-full w-full flex-col">
              <TabsContent
                className="flex h-full flex-col gap-y-8"
                value="edit"
                tabIndex={-1}
              >
                <input
                  className="transparent dark:placeholder:text-polar-500 min-w-full border-none bg-transparent text-3xl font-medium shadow-none outline-none"
                  autoFocus
                  placeholder="Title"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                />
                <MarkdownEditor
                  className="focus:ring-none dakr:shadow-none h-full overflow-visible rounded-none border-none bg-transparent p-0 outline-none dark:bg-transparent dark:outline-none dark:focus:ring-transparent"
                  value={body}
                  onChange={onBodyChange}
                />
              </TabsContent>
              <TabsContent value="preview">
                <StaggerReveal className="dark:md:bg-polar-800 dark:md:border-polar-700 relative flex w-full flex-col items-center rounded-3xl md:bg-white md:p-12 md:shadow-xl dark:md:border">
                  <LongformPost {...previewProps} />
                </StaggerReveal>
              </TabsContent>
            </div>
          </div>
        </DashboardBody>
      </div>
    </>
  )
}
