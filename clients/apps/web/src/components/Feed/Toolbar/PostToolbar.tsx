import { Article, ArticleVisibility } from '@polar-sh/sdk'
import {
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { PreviewToolbar } from './PreviewToolbar'

interface PostToolbarProps {
  article?: Article
  previewAs: string
  onPreviewAsChange: (value: string) => void
  canCreate?: boolean
}

export const PostToolbar = ({
  article,
  previewAs,
  onPreviewAsChange,
  canCreate,
}: PostToolbarProps) => {
  const isPublished = Boolean(
    article &&
      article.published_at &&
      new Date(article.published_at) <= new Date() &&
      article.visibility === ArticleVisibility.PUBLIC,
  )

  return (
    <div className="dark:bg-polar-950 sticky top-0 z-10 flex w-full flex-col bg-gray-50">
      <div className="relative mx-auto flex w-full min-w-0 max-w-screen-xl flex-row items-center justify-between gap-x-4 px-4 py-4 sm:px-6 md:px-16">
        <TabsList className="flex h-12 w-full flex-row items-center">
          <div className="flex-none">
            <TabsTrigger value="edit" size="small">
              Editor
            </TabsTrigger>
            <TabsTrigger value="preview" size="small">
              Preview
            </TabsTrigger>
          </div>
          <div className="grow">
            <TabsContent
              value="preview"
              className="mt-0 flex flex-row justify-center gap-x-2"
            >
              <PreviewToolbar
                article={article}
                previewAs={previewAs}
                onPreviewAsChange={onPreviewAsChange}
              />
            </TabsContent>
          </div>
          <div className="flex-none">
            <TabsTrigger
              value="settings"
              size="small"
              disabled={canCreate === false}
              className="rounded-4xl flex flex-row space-x-2 border border-gray-800 px-4 py-2 text-gray-700 data-[state=active]:border-none dark:border-gray-800 dark:text-gray-200"
            >
              {isPublished ? 'Settings' : 'Publish'}
            </TabsTrigger>
          </div>
        </TabsList>
      </div>
    </div>
  )
}
