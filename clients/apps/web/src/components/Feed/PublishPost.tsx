'use client'

import { ModalHeader } from '@/components/Modal'
import { useAuth } from '@/hooks'
import { CalendarIcon } from '@heroicons/react/24/outline'
import {
  LanguageOutlined,
  LinkOutlined,
  LockOutlined,
} from '@mui/icons-material'
import {
  Article,
  ArticleUpdateVisibilityEnum,
  ArticleVisibilityEnum,
} from '@polar-sh/sdk'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import {
  Button,
  Input,
  PolarTimeAgo,
  Tabs,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { Calendar } from 'polarkit/components/ui/calendar'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Banner } from 'polarkit/components/ui/molecules'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'polarkit/components/ui/popover'
import { useSendArticlePreview, useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface PublishModalContentProps {
  article: Article
  hide: () => void
}

export const PublishModalContent = ({
  article,
  hide,
}: PublishModalContentProps) => {
  const { currentUser } = useAuth()
  const [paidSubscribersOnly, setPaidSubscribersOnly] = useState(
    article.paid_subscribers_only ?? false,
  )
  const [visibility, setVisibility] = useState<ArticleUpdateVisibilityEnum>(
    article.visibility,
  )
  const [sendEmail, setSendEmail] = useState(article.notify_subscribers)
  const [previewEmailAddress, setPreviewEmailAddress] = useState('')
  const [previewSent, setPreviewSent] = useState<string>()

  const [publishAt, setPublishAt] = useState<Date | undefined>(
    article.published_at ? new Date(article.published_at) : undefined,
  )

  useEffect(() => {
    setPreviewEmailAddress(currentUser?.email || '')
  }, [currentUser])

  const router = useRouter()

  const update = useUpdateArticle()
  const sendPreview = useSendArticlePreview()

  const handleSendPreview = async () => {
    // visibility must be at least link to send emails
    if (visibility === ArticleVisibilityEnum.PRIVATE) {
      setVisibility(ArticleVisibilityEnum.HIDDEN)
      setDidAutoChangeVisibility(true)
    }

    await sendPreview.mutateAsync({
      id: article.id,
      email: previewEmailAddress,
    })

    setPreviewSent(previewEmailAddress)
  }

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)

    const updated = await update.mutateAsync({
      id: article.id,
      articleUpdate: {
        paid_subscribers_only: paidSubscribersOnly,
        visibility,
        set_published_at: publishAt ? true : false,
        published_at: publishAt ? publishAt.toISOString() : undefined,
        notify_subscribers: sendEmail,
      },
    })

    setIsSaving(false)

    hide()
  }

  const [didAutoChangeVisibility, setDidAutoChangeVisibility] = useState(false)

  const onChangeSendEmail = (checked: boolean) => {
    setSendEmail(checked)

    if (checked && visibility !== ArticleVisibilityEnum.PUBLIC) {
      setVisibility(ArticleVisibilityEnum.PUBLIC)
      setDidAutoChangeVisibility(true)
    }

    if (checked && publishAt === undefined) {
      setPublishAt(new Date())
    }
  }

  const onVisibilityChange = (visibility: ArticleUpdateVisibilityEnum) => {
    setVisibility(visibility)
    setDidAutoChangeVisibility(false)
  }

  const onChangePublishAt = (v: Date | undefined) => {
    setPublishAt(v)

    if (v && visibility !== ArticleVisibilityEnum.PUBLIC) {
      setVisibility(ArticleVisibilityEnum.PUBLIC)
      setDidAutoChangeVisibility(true)
    }
  }

  const onPublishAtReset = () => {
    if (article.published_at) {
      setPublishAt(new Date(article.published_at))
    } else {
      setPublishAt(undefined)
    }
  }

  const saveVerb = useMemo(() => {
    // Already published
    if (article.published_at && new Date(article.published_at) <= new Date()) {
      // already sent via email
      if (article.email_sent_to_count) {
        return 'Save'
      }

      if (sendEmail) {
        return 'Save & send'
      }

      return 'Save'
    }

    if (publishAt && publishAt > new Date()) {
      if (sendEmail) {
        return 'Save and send later'
      }
      return 'Save and publish later'
    }

    if (visibility === ArticleVisibilityEnum.PUBLIC) {
      if (sendEmail) {
        return 'Publish now & send'
      }

      return 'Publish now'
    }

    return 'Save'
  }, [article, sendEmail, visibility, publishAt])

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={hide}>
        <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
          {article.published_at ? 'Settings' : 'Publish Post'}
        </h3>
      </ModalHeader>
      <div className="overflow-scroll p-8">
        <div className="flex flex-col gap-y-6">
          <div className="dark:border-polar-700 rounded-2xl border border-gray-100 p-6">
            <AudiencePicker
              paidSubscribersOnly={paidSubscribersOnly}
              onChange={setPaidSubscribersOnly}
            />
          </div>
          <div className="dark:border-polar-700 rounded-2xl border border-gray-100 p-6">
            <VisibilityPicker
              paidSubscribersOnly={paidSubscribersOnly}
              visibility={visibility}
              privateVisibilityAllowed={!sendEmail && !publishAt}
              linkVisibilityAllowed={!sendEmail && !publishAt}
              article={article}
              onChange={onVisibilityChange}
            />
          </div>

          <div className="dark:border-polar-700 flex flex-col gap-y-6 rounded-2xl border border-gray-100 p-6">
            <ScheduledPostPicker
              publishAt={publishAt}
              article={article}
              onChange={onChangePublishAt}
              onReset={onPublishAtReset}
            />
          </div>

          <div className="dark:border-polar-700 flex flex-col gap-y-6 rounded-2xl border border-gray-100 p-6">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <span className="font-medium">Email</span>
              </div>
              <div className="flex flex-col gap-y-6">
                {!article.notifications_sent_at ? (
                  <div className="flex flex-row items-center gap-x-2">
                    <Checkbox
                      checked={sendEmail}
                      onCheckedChange={(checked) =>
                        onChangeSendEmail(Boolean(checked))
                      }
                    />
                    <span className="text-sm">
                      Send post as email to subscribers
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-row items-center gap-x-2">
                    <Checkbox checked={true} disabled={true} />
                    <span className="text-sm">
                      This post was sent via email{' '}
                      <PolarTimeAgo
                        date={new Date(article.notifications_sent_at)}
                      />
                    </span>
                  </div>
                )}

                {article.published_at &&
                new Date(article.published_at) < new Date() &&
                article.visibility === ArticleVisibilityEnum.PUBLIC &&
                !article.notifications_sent_at ? (
                  <Banner color="blue">
                    This article is published and public, but has not been sent
                    over email.
                  </Banner>
                ) : null}

                <div className="flex flex-col gap-y-4">
                  <span className="text-sm font-medium">Send Preview</span>
                  <div className="flex flex-row items-center gap-x-2">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={previewEmailAddress}
                      onChange={(e) => setPreviewEmailAddress(e.target.value)}
                    />
                    <Button variant="secondary" onClick={handleSendPreview}>
                      Send
                    </Button>
                  </div>
                  {previewSent && (
                    <Banner color="green">
                      Email preview sent to {previewSent}
                    </Banner>
                  )}
                </div>

                {didAutoChangeVisibility && (
                  <Banner color="blue">
                    The visibility has been changed to{' '}
                    <em className="capitalize">{visibility}</em>
                  </Banner>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-row items-center justify-end gap-x-2">
            <Button variant="ghost" onClick={hide}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              {saveVerb}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

interface VisibilityPickerProps {
  visibility: ArticleUpdateVisibilityEnum
  paidSubscribersOnly: boolean
  privateVisibilityAllowed: boolean
  linkVisibilityAllowed: boolean
  article: Article
  onChange: (visibility: ArticleUpdateVisibilityEnum) => void
}

const VisibilityPicker = ({
  paidSubscribersOnly,
  visibility,
  privateVisibilityAllowed,
  linkVisibilityAllowed,
  article,
  onChange,
}: VisibilityPickerProps) => {
  const visibilityDescription = useMemo(() => {
    const audience = paidSubscribersOnly
      ? 'Premium Subscribers'
      : 'All Subscribers'

    switch (visibility) {
      case ArticleVisibilityEnum.PRIVATE:
        return `Only members of ${article.organization.name} can see this post`
      case ArticleVisibilityEnum.HIDDEN:
        return `${audience} with the link can see this post`
      case ArticleVisibilityEnum.PUBLIC:
        return `${audience} can see this post on the web`
    }
  }, [visibility, paidSubscribersOnly])

  const handleVisibilityChange = useCallback(
    (visibility: string) => {
      onChange(visibility as ArticleUpdateVisibilityEnum)
    },
    [onChange],
  )

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <span className="font-medium">Visibility</span>
        <p className="text-polar-500 dark:text-polar-500 text-sm">
          Determines the visibility of this post for eligible subscribers
        </p>
      </div>
      <Tabs value={visibility} onValueChange={handleVisibilityChange}>
        <TabsList className="dark:border-polar-700 dark:border">
          <TabsTrigger
            value={ArticleVisibilityEnum.PRIVATE}
            disabled={!privateVisibilityAllowed}
          >
            <LockOutlined
              className={twMerge(
                visibility === ArticleUpdateVisibilityEnum.PRIVATE &&
                  'text-blue-500 dark:text-blue-400',
              )}
              fontSize="inherit"
            />
            <span>Private</span>
          </TabsTrigger>
          <TabsTrigger
            value={ArticleVisibilityEnum.HIDDEN}
            disabled={!linkVisibilityAllowed}
          >
            <LinkOutlined
              className={twMerge(
                visibility === ArticleUpdateVisibilityEnum.HIDDEN &&
                  'text-blue-500 dark:text-blue-400',
              )}
              fontSize="inherit"
            />
            <span>Link</span>
          </TabsTrigger>
          <TabsTrigger value={ArticleVisibilityEnum.PUBLIC}>
            <LanguageOutlined
              className={twMerge(
                visibility === ArticleUpdateVisibilityEnum.PUBLIC &&
                  'text-blue-500 dark:text-blue-400',
              )}
              fontSize="inherit"
            />
            <span>Public</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Banner color="blue">{visibilityDescription}</Banner>
    </div>
  )
}

interface AudiencePickerProps {
  paidSubscribersOnly: boolean
  onChange: (paidSubscribersOnly: boolean) => void
}

const AudiencePicker = ({
  paidSubscribersOnly,
  onChange,
}: AudiencePickerProps) => {
  const handleAudienceChange = useCallback(
    (audience: string) => {
      onChange(audience === 'premium-subscribers')
    },
    [onChange],
  )

  const audience = useMemo(
    () => (paidSubscribersOnly ? 'premium-subscribers' : 'all-subscribers'),
    [paidSubscribersOnly],
  )

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <span className="font-medium">Audience</span>
        <p className="text-polar-500 dark:text-polar-500 text-sm">
          Pick the audience for this post
        </p>
      </div>
      <Tabs value={audience} onValueChange={handleAudienceChange}>
        <TabsList className="dark:border-polar-700 dark:border">
          <TabsTrigger className="flex-col items-start" value="all-subscribers">
            <span>All Subscribers</span>
          </TabsTrigger>
          <TabsTrigger
            className="flex-col items-start"
            value="premium-subscribers"
          >
            <span>Premium Subscribers</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}

interface ScheduledPostPickerProps {
  publishAt: Date | undefined
  article: Article
  onChange: (v: Date | undefined) => void
  onReset: () => void
}

const ScheduledPostPicker = ({
  publishAt,
  article,
  onChange,
  onReset,
}: ScheduledPostPickerProps) => {
  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-start justify-between gap-y-2">
        <span className="font-medium">Publishing date & time</span>
      </div>
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-row justify-between">
          <DateTimePicker
            date={publishAt}
            canSelectFuture={true}
            canSelectPast={true}
            onChange={onChange}
          />
          {publishAt ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={onReset}
                variant={'ghost'}
                className="m-0 h-auto p-0"
              >
                Reset
              </Button>

              <Button
                onClick={() => onChange(new Date())}
                variant={'outline'}
                className="m-0 h-auto "
              >
                Now
              </Button>
            </div>
          ) : null}
        </div>

        {publishAt ? (
          <div>
            <span className="text-sm font-medium">
              {publishAt < new Date() ? 'Published' : 'Publishing'}{' '}
              <PolarTimeAgo date={publishAt} />
            </span>
            <div className="grid w-fit grid-cols-2 text-sm">
              <div className="font-medium">Your time zone</div>
              <div className="text-gray-500">
                {publishAt.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                at{' '}
                {publishAt.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })}
              </div>

              <div className="font-medium">UTC</div>
              <div className="text-gray-500">
                {publishAt.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}{' '}
                at{' '}
                {publishAt.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short',
                  timeZone: 'UTC',
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface DateTimePickerProps {
  date: Date | undefined
  onChange: (v: Date) => void
  canSelectFuture: boolean
  canSelectPast: boolean
}

type Time = { hour?: number; min?: number }

const DateTimePicker = ({
  date,
  onChange,
  canSelectFuture,
  canSelectPast,
}: DateTimePickerProps) => {
  const [datePickerDate, setDatePickerDate] = useState<Date>(date || new Date())

  const [time, setTime] = useState<Time>({
    hour: 0,
    min: 0,
  })

  useEffect(() => {
    setDatePickerDate(date || new Date())
    setTime({
      hour: date ? date.getHours() : 0,
      min: date ? date.getMinutes() : 0,
    })
  }, [date])

  const changed = (date: Date, time: Time) => {
    let d = new Date()

    d.setFullYear(date.getFullYear())
    d.setMonth(date.getMonth())
    d.setDate(date.getDate())
    d.setHours(time.hour || 0)
    d.setMinutes(time.min || 0)
    d.setSeconds(0)
    d.setMilliseconds(0)

    onChange(d)
  }

  const onChangeDate = (v?: Date) => {
    if (!v) {
      v = new Date()
    }
    setDatePickerDate(v)
    changed(v || new Date(), time)
  }

  const onChangeTime = (v: Time) => {
    setTime(v)
    changed(datePickerDate || new Date(), v)
  }

  return (
    <div className="flex items-center gap-4 ">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={'outline'}
            className={twMerge(
              'w-[280px] justify-start text-left font-normal',
              !date && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            toDate={!canSelectFuture ? new Date() : undefined}
            fromDate={!canSelectPast ? new Date() : undefined}
            classNames={{
              day_today: 'bg-gray-200',
              cell: 'h-9 w-9 text-center text-sm p-0 relative rounded-md focus-within:relative focus-within:z-20',
            }}
            mode="single"
            selected={date}
            onSelect={onChangeDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <span className="text-sm">at</span>

      <div className="flex items-center gap-1 text-sm">
        <Input
          className="w-[80px]"
          type="number"
          min={0}
          max={23}
          value={time.hour}
          onChange={(e) => {
            const h = parseInt(e.target.value)
            const hour =
              !isNaN(h) && isFinite(h)
                ? Math.max(0, Math.min(23, h))
                : undefined

            const n = {
              ...time,
              hour,
            }
            onChangeTime(n)
          }}
        />
        <span>:</span>
        <Input
          className="w-[80px]"
          type="number"
          min={0}
          max={59}
          value={time.min}
          onChange={(e) => {
            const m = parseInt(e.target.value)
            const minute =
              !isNaN(m) && isFinite(m)
                ? Math.max(0, Math.min(59, m))
                : undefined

            const n = {
              ...time,
              min: minute,
            }
            onChangeTime(n)
          }}
        />
      </div>
    </div>
  )
}
