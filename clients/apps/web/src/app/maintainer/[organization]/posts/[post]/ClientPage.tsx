'use client'

import LongformPost from '@/components/Feed/LongformPost'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MarkdownEditor } from '@/components/Markdown/MarkdownEditor'
import { MarkdownPreview } from '@/components/Markdown/MarkdownPreview'
import Spinner from '@/components/Shared/Spinner'
import { KeyboardArrowDownOutlined } from '@mui/icons-material'
import {
  ArticleUpdate,
  ArticleUpdateVisibilityEnum,
  ArticleVisibilityEnum,
} from '@polar-sh/sdk'
import { useParams, useRouter } from 'next/navigation'
import {
  Button,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useArticleLookup, useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'

const ClientPage = () => {
  const { post: postSlug, organization: organizationName } = useParams()
  const post = useArticleLookup(organizationName as string, postSlug as string)

  const router = useRouter()

  const [updateArticle, setUpdateArticle] = useState<ArticleUpdate>({})

  useEffect(() => {
    setUpdateArticle((a) => ({
      ...a,
      body: post.data?.body,
      title: post.data?.title,
      visibility: post.data?.visibility,
    }))
  }, [post.data])

  const update = useUpdateArticle()

  const handleSave = useCallback(async () => {
    if (!post?.data?.id) {
      return
    }

    await update.mutateAsync({
      id: post.data.id,
      articleUpdate: updateArticle,
    })

    router.push(`/maintainer/${organizationName}/posts`)
  }, [update, post, updateArticle])

  const handleVisibilityChange = useCallback(
    (visibility: ArticleUpdateVisibilityEnum) => {
      setUpdateArticle((a) => ({
        ...a,
        visibility,
      }))
    },
    [setUpdateArticle],
  )

  if (!post.data) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <>
      <DashboardBody>
        <div className="flex h-full flex-row">
          <div className="flex h-full w-full flex-col items-start gap-y-8">
            <div className="flex w-full flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                Edit Post
              </h3>

              <div className="flex flex-row items-center gap-x-2">
                <Button
                  className="self-start"
                  onClick={handleSave}
                  loading={update.isPending}
                >
                  Save Post
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-y-3">
              <span>Title</span>
              <Input
                className="min-w-[320px]"
                placeholder="Title"
                value={updateArticle?.title}
                onChange={(e) =>
                  setUpdateArticle((a) => ({
                    ...a,
                    title: e.target.value,
                  }))
                }
              />
            </div>
            {updateArticle.visibility && (
              <VisibilityPicker
                visibility={updateArticle.visibility}
                onChange={handleVisibilityChange}
              />
            )}
            <div className="flex h-full w-full flex-col">
              <Tabs
                className="flex h-full flex-col gap-y-6"
                defaultValue="edit"
              >
                <TabsList className="dark:border-polar-700 border border-gray-200">
                  <TabsTrigger value="edit">Markdown</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent className="h-full" value="edit">
                  {post && (
                    <MarkdownEditor
                      value={updateArticle?.body || ''}
                      onChange={(value) =>
                        setUpdateArticle((a) => ({
                          ...a,
                          body: value,
                        }))
                      }
                    />
                  )}
                </TabsContent>
                <TabsContent value="preview">
                  {post ? (
                    <div className="dark:bg-polar-800 dark:border-polar-700 flex w-full flex-col items-center rounded-3xl bg-white p-16 shadow-xl dark:border">
                      <LongformPost
                        post={{
                          ...post.data,
                          title: updateArticle.title ?? '',
                          body: updateArticle.body ?? '',
                        }}
                      />
                    </div>
                  ) : (
                    <MarkdownPreview>{updateArticle.body}</MarkdownPreview>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

export default ClientPage

interface VisibilityPickerProps {
  visibility: ArticleUpdateVisibilityEnum
  onChange: (visibility: ArticleUpdateVisibilityEnum) => void
}

const VisibilityPicker = ({ visibility, onChange }: VisibilityPickerProps) => {
  const visibilityDescription = useMemo(() => {
    switch (visibility) {
      case ArticleVisibilityEnum.PRIVATE:
        return 'Only members of this organization can see this post'
      case ArticleVisibilityEnum.HIDDEN:
        return 'Anyone with the link can see this post'
      case ArticleVisibilityEnum.PUBLIC:
        return 'Anyone eligible can see this post'
    }
  }, [visibility])

  const handleVisibilityChange = useCallback(
    (visibility: ArticleUpdateVisibilityEnum) => () => {
      onChange(visibility)
    },
    [onChange],
  )

  return (
    <div className="flex flex-col items-start gap-y-3">
      <span>Visibility</span>
      <p className="dark:text-polar-500 text-sm text-gray-500">
        {visibilityDescription}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="justify-between" variant="secondary">
            <span className="capitalize">{visibility}</span>
            <KeyboardArrowDownOutlined className="ml-2" fontSize="small" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="dark:bg-polar-800 bg-gray-50 shadow-lg"
          align="start"
        >
          <DropdownMenuItem
            onClick={handleVisibilityChange(ArticleVisibilityEnum.PRIVATE)}
          >
            <span>Private</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleVisibilityChange(ArticleVisibilityEnum.HIDDEN)}
          >
            <span>Hidden</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleVisibilityChange(ArticleVisibilityEnum.PUBLIC)}
          >
            <span>Public</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
