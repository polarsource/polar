'use client'

import { useModal } from '@/components/Modal/useModal'
import { ConfirmModal } from '@/components/Shared/ConfirmModal'
import { Article, ArticleUpdate, ArticleVisibilityEnum } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button, Input, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useDeleteArticle, useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { AudiencePicker } from './AudiencePicker'
import { PublishSummary } from './PublishSummary'
import { PublishingTimePicker } from './PublishingTimePicker'

interface PublishModalContentProps {
  article: Article
}

export const PublishSettings = ({ article }: PublishModalContentProps) => {
  const form = useForm<ArticleUpdate>({
    defaultValues: {
      paid_subscribers_only: article.paid_subscribers_only,
      notify_subscribers: article.notify_subscribers,
      published_at: article.published_at,
      slug: article.slug,
      is_pinned: article.is_pinned,

      // subscription_id: subscription.id,
      // subscription_benefit_id: benefit.id,
    },
  })
  const { handleSubmit } = form

  const [paidSubscribersOnly, setPaidSubscribersOnly] = useState(
    article.paid_subscribers_only ?? false,
  )
  // const [sendEmail, setSendEmail] = useState(article.notify_subscribers)
  const [publishAt, setPublishAt] = useState<Date | undefined>(
    article.published_at ? new Date(article.published_at) : undefined,
  )
  // const [slug, setSlug] = useState<string>(article.slug)
  // const [slugChanged, setSlugChanged] = useState(false)
  // const [isPinned, setIsPinned] = useState(article.is_pinned)

  const router = useRouter()
  const { hide: hideModal, isShown: isModalShown, show: showModal } = useModal()

  // const onChangeSendEmail = (checked: boolean) => {
  //   setSendEmail(checked)
  // }

  const onChangePublishAt = (v: Date | undefined) => {
    setPublishAt(v)
  }

  const archiveArticle = useDeleteArticle()

  const handleArchiveArticle = useCallback(async () => {
    const response = await archiveArticle.mutateAsync({ id: article.id })

    if (response.ok) {
      router.push(`/maintainer/${article.organization.name}/posts`)
    } else {
      hideModal()
    }
  }, [archiveArticle, article, hideModal, router])

  const isPublished = Boolean(
    article.published_at &&
      new Date(article.published_at) < new Date() &&
      article.visibility === ArticleVisibilityEnum.PUBLIC,
  )

  const onSubmit = () => {}

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full flex-row"
        >
          <div className="flex w-2/3 flex-shrink-0 flex-col gap-y-8">
            <ShadowBoxOnMd className="flex flex-col gap-y-8">
              <>
                {!isPublished && <PublishingTimePicker />}

                <AudiencePicker />

                <FormNotifySubscribers article={article} />

                <FormSlug articleId={article.id} />

                <FormIsPinned />
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
                <Button variant="destructive" size="sm" onClick={showModal}>
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
                isShown={isModalShown}
                hide={hideModal}
                destructive
              />
            </ShadowBoxOnMd>
          </div>

          <PublishSummary
            article={article}
            // article={{
            //   ...article,
            //   ...form.getValues(),
            //   // paid_subscribers_only: paidSubscribersOnly,
            //   // published_at: publishAt ? publishAt.toISOString() : undefined,
            //   // notify_subscribers: sendEmail,
            //   // slug,
            //   // is_pinned: isPinned,
            // }}
          />
        </form>
      </Form>
    </>
  )
}

const FormSlug = (props: { articleId: string }) => {
  const { control } = useFormContext<ArticleUpdate>()

  return (
    <FormField
      control={control}
      name="slug"
      rules={{
        required: 'This field is required',
        minLength: 1,
      }}
      render={({ field }) => {
        const router = useRouter()

        const updateArticle = useUpdateArticle()
        const [slugIsSaving, setSlugIsSaving] = useState(false)

        const onSaveSlug = async () => {
          setSlugIsSaving(true)
          const art = await updateArticle.mutateAsync({
            id: props.articleId,
            articleUpdate: {
              slug: field.value,
            },
          })

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
                  onChange={field.onChange}
                  defaultValue={field.value}
                />
              </FormControl>

              <Button
                disabled={!field.value}
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
        // const { formItemId } = useFormField()

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
