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
    <div className="sticky top-0 z-10 flex w-full flex-col bg-white dark:bg-transparent">
      <div className="relative mx-auto flex w-full min-w-0 max-w-screen-xl flex-row items-center justify-between gap-x-4 px-4 py-4 sm:px-6 md:px-16">
        <TabsList>
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
          className="flex flex-row items-center gap-x-2"
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
