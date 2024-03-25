'use client'

import ImageUpload from '@/components/Form/ImageUpload'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { firstImageUrlFromMarkdown } from '@/utils/markdown'
import {
  Article,
  ArticleUpdate,
  ArticleVisibilityEnum,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { setValidationErrors } from 'polarkit/api/errors'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { Textarea } from 'polarkit/components/ui/textarea'
import { useDeleteArticle, useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import PreviewText from '../Markdown/preview'
import { AudiencePicker } from './AudiencePicker'
import { PublishShareModal } from './PublishShareModal'
import { PublishSummary, isPublished } from './PublishSummary'
import { PublishingTimePicker } from './PublishingTimePicker'

interface PublishModalContentProps {
  article: Article
}

export const PublishSettings = ({ article }: PublishModalContentProps) => {
  const form = useForm<ArticleUpdate>({
    defaultValues: {
      paid_subscribers_only: article.paid_subscribers_only,
      paid_subscribers_only_ends_at: article.paid_subscribers_only
        ? article.paid_subscribers_only_ends_at
        : undefined,
      notify_subscribers: article.notify_subscribers,
      published_at: article.published_at,
      slug: article.slug,
      is_pinned: article.is_pinned,
      og_description: article.og_description,
      og_image_url: article.og_image_url,
    },
  })
  const { handleSubmit, setError } = form

  const router = useRouter()

  const {
    hide: hideArchiveModal,
    isShown: isArchiveModalShown,
    show: showArchiveModal,
  } = useModal()

  const archiveArticle = useDeleteArticle()

  const handleArchiveArticle = useCallback(async () => {
    const response = await archiveArticle.mutateAsync({ id: article.id })

    if (response.ok) {
      router.push(`/maintainer/${article.organization.name}/posts`)
    } else {
      hideArchiveModal()
    }
  }, [archiveArticle, article, hideArchiveModal, router])

  const update = useUpdateArticle()

  const {
    hide: hidePublishedShareModal,
    isShown: isPublishedShareModalShown,
    show: showPublishedShareModal,
  } = useModal()

  const isAlreadyPublished = isPublished(article)

  const onSubmit = async () => {
    const publishedAt =
      form.getValues('published_at') ?? new Date().toISOString()

    const wasAlreadyPublished = isPublished(article)

    const slugChanged = article.slug !== form.getValues('slug')

    try {
      const updatedArticle = await update.mutateAsync({
        id: article.id,
        articleUpdate: {
          ...form.getValues(),

          // Always set published at, even if unset.
          set_published_at: true,
          published_at: publishedAt ?? new Date().toISOString(),

          visibility: ArticleVisibilityEnum.PUBLIC,

          set_og_description: true,
          set_og_image_url: true,
        },
      })

      const isPublishedAfterSave = isPublished(updatedArticle)

      const didPublish = !wasAlreadyPublished && isPublishedAfterSave

      if (didPublish) {
        showPublishedShareModal()
        return
      }

      // Redirect if slug changed
      if (slugChanged) {
        router.push(
          `/maintainer/${article.organization.name}/posts/${updatedArticle.slug}#settings`,
        )
      }
    } catch (e) {
      if (e instanceof ResponseError) {
        const body = await e.response.json()
        if (e.response.status === 422) {
          const validationErrors = body['detail'] as ValidationError[]
          setValidationErrors(validationErrors, setError)
        }
      }
    }
  }

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-8 md:flex-row"
        >
          <div className="flex flex-shrink-0 flex-col gap-8 md:w-2/3">
            <ShadowBoxOnMd className="flex flex-col gap-y-8">
              <>
                {!isAlreadyPublished && <PublishingTimePicker />}

                <AudiencePicker />

                <FormNotifySubscribers article={article} />

                <FormSlug article={article} />

                <FormIsPinned />
              </>
            </ShadowBoxOnMd>

            <ShadowBoxOnMd className="flex flex-col gap-y-8">
              <>
                <div className="flex flex-col gap-y-2">
                  <span className="font-medium">Social metadata</span>
                  <p className="text-polar-500 dark:text-polar-500 text-sm">
                    Customize the image and description used when sharing this
                    post on other platforms.
                  </p>
                </div>

                <div className="flex w-full items-stretch gap-x-4">
                  <OgImage article={article} />

                  <OgDescription article={article} />
                </div>
              </>
            </ShadowBoxOnMd>

            <ShadowBoxOnMd className="flex flex-col gap-y-8">
              <div className="flex flex-row items-start justify-between">
                <div className="flex flex-col gap-y-1">
                  <h3 className="dark:text-polar-50 font-medium text-gray-950">
                    Archive
                  </h3>
                  <p className="dark:text-polar-500 text-sm text-gray-500">
                    This action will unpublish the post & permanently remove it
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    showArchiveModal()
                  }}
                >
                  Archive
                </Button>
              </div>
              <ConfirmModal
                title="Archive Post"
                description={
                  'This action will unpublish the post & permanently remove it.'
                }
                destructiveText="Archive"
                onConfirm={handleArchiveArticle}
                isShown={isArchiveModalShown}
                hide={hideArchiveModal}
                destructive
              />
            </ShadowBoxOnMd>
          </div>

          <PublishSummary article={article} isSaving={update.isPending} />
        </form>
      </Form>

      <PublishShareModal
        isShown={isPublishedShareModalShown}
        hide={hidePublishedShareModal}
        article={article}
      />
    </>
  )
}

const FormSlug = (props: { article: Article }) => {
  const { control } = useFormContext<ArticleUpdate>()
  const router = useRouter()
  const updateArticle = useUpdateArticle()
  const [slugIsSaving, setSlugIsSaving] = useState(false)
  const [changed, setChanged] = useState(false)

  return (
    <FormField
      control={control}
      name="slug"
      rules={{
        required: 'This field is required',
        minLength: 1,
      }}
      render={({ field, fieldState }) => {
        const onSaveSlug = async () => {
          setSlugIsSaving(true)
          const art = await updateArticle.mutateAsync({
            id: props.article.id,
            articleUpdate: {
              slug: field.value,
            },
          })

          setChanged(false)

          // Redirect
          router.push(
            `/maintainer/${art.organization.name}/posts/${art.slug}#settings`,
          )

          // Wait for redirect
          await new Promise((r) => setTimeout(r, 2000))

          setSlugIsSaving(false)
        }

        return (
          <FormItem>
            <div className="flex flex-col gap-2">
              <FormLabel>Slug</FormLabel>
              <p className="text-polar-500 dark:text-polar-500 text-sm">
                Change the slug of the article. The slug is used in public URLs.
              </p>
            </div>

            <div className="flex flex-row items-center gap-2">
              <FormControl>
                <Input
                  type="text"
                  onChange={(v) => {
                    field.onChange(v)
                    setChanged(true)
                  }}
                  defaultValue={field.value}
                />
              </FormControl>

              <Button
                disabled={!changed}
                loading={updateArticle.isPending || slugIsSaving}
                onClick={onSaveSlug}
              >
                Save
              </Button>
            </div>

            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

const FormNotifySubscribers = (props: { article: Article }) => {
  const { control } = useFormContext<ArticleUpdate>()

  return (
    <FormField
      control={control}
      name="notify_subscribers"
      render={({ field }) => {
        if (props.article.notifications_sent_at) {
          return (
            <FormItem>
              <div className="flex flex-col gap-2">
                <FormLabel>Email</FormLabel>
                <p className="text-polar-500 dark:text-polar-500 text-sm">
                  This post has been sent to {props.article.email_sent_to_count}{' '}
                  {props.article.email_sent_to_count === 1
                    ? 'subscriber'
                    : 'subscribers'}
                  .
                </p>
              </div>

              <FormControl>
                <div className="flex flex-row items-center gap-x-2">
                  <Checkbox checked={true} disabled={true} />
                  <label className="text-sm">
                    Send post as email to subscribers
                  </label>
                </div>
              </FormControl>

              <FormMessage />
            </FormItem>
          )
        }

        return (
          <FormItem>
            <div className="flex flex-col gap-2">
              <FormLabel>Email</FormLabel>
              <p className="text-polar-500 dark:text-polar-500 text-sm">
                Send to subscribers when a post is published
              </p>
            </div>

            <div className="flex flex-row items-center gap-x-2">
              <FormControl>
                <Checkbox
                  onCheckedChange={field.onChange}
                  checked={field.value}
                />
              </FormControl>
              <FormLabel className="text-sm font-normal">
                Send post as email to subscribers
              </FormLabel>
            </div>

            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

const FormIsPinned = () => {
  const { control } = useFormContext<ArticleUpdate>()

  return (
    <FormField
      control={control}
      name="is_pinned"
      render={({ field }) => {
        return (
          <FormItem>
            <div className="flex flex-col gap-2">
              <FormLabel>Pin</FormLabel>
            </div>

            <div className="flex flex-row items-center gap-x-2">
              <FormControl>
                <Checkbox
                  onCheckedChange={field.onChange}
                  checked={field.value}
                />
              </FormControl>

              <FormLabel className="text-sm font-normal">
                Pin this post to the top of your profile
              </FormLabel>
            </div>

            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

const OgDescription = ({ article }: { article: Article }) => {
  const { control } = useFormContext<ArticleUpdate>()

  const [defaultDescription, setDefaultDescription] = useState<
    string | undefined
  >()

  const [previewTextEl, setPreviewTextEl] = useState<HTMLDivElement | null>(
    null,
  )

  useEffect(() => {
    setDefaultDescription(previewTextEl?.innerText ?? undefined)
  }, [article, previewTextEl])

  return (
    <>
      <div className="hidden" ref={setPreviewTextEl}>
        <PreviewText article={article} />
      </div>

      <FormField
        control={control}
        name="og_description"
        render={({ field }) => {
          return (
            <FormItem className="flex flex-1 flex-col">
              <div className="flex flex-col gap-2">
                <FormLabel>Description</FormLabel>
              </div>

              <div className="flex flex-1 flex-col ">
                <FormControl>
                  <Textarea
                    className="flex-1"
                    onChange={field.onChange}
                    defaultValue={field.value}
                    placeholder={defaultDescription}
                  />
                </FormControl>
              </div>

              <FormMessage />
            </FormItem>
          )
        }}
      />
    </>
  )
}

const OgImage = ({ article }: { article: Article }) => {
  const { control } = useFormContext<ArticleUpdate>()

  const defaultImage = firstImageUrlFromMarkdown(article.body)

  return (
    <FormField
      control={control}
      name="og_image_url"
      render={({ field }) => {
        return (
          <FormItem>
            <div className="flex flex-col gap-2">
              <FormLabel>Image</FormLabel>
            </div>

            <div className="flex flex-row items-center gap-2">
              <FormControl>
                <ImageUpload
                  defaultValue={field.value ?? defaultImage}
                  onUploaded={field.onChange}
                />
              </FormControl>
            </div>

            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
