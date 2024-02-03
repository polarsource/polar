import { Article, ArticleVisibilityEnum } from '@polar-sh/sdk'
import {
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
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
    article.visibility === ArticleVisibilityEnum.PUBLIC,
  )

  return (
    <div className="dark:border-polar-800 dark:bg-polar-900 sticky top-0 z-10 flex w-full flex-col border-b border-gray-100 bg-white">
      <div className="relative mx-auto flex w-full min-w-0 max-w-screen-xl flex-row items-center justify-between gap-x-4 px-4 py-4 sm:px-6 md:px-8">
        <TabsList className="relative flex-row dark:border md:flex-row">
          <TabsTrigger value="edit" size="small">
            Markdown
          </TabsTrigger>
          <TabsTrigger value="preview" size="small">
            Preview
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            size="small"
            disabled={canCreate === false}
          >
            {isPublished ? 'Settings' : 'Publish'}
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="preview"
          className="absolute right-4 mt-0 flex flex-row items-center gap-x-2 sm:right-6 md:right-8"
        >
          <PreviewToolbar
            article={article}
            previewAs={previewAs}
            onPreviewAsChange={onPreviewAsChange}
          />
        </TabsContent>
      </div>
    </div>
  )
}
