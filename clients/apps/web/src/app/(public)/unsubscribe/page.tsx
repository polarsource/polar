'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit/api'
import { Button, ShadowBox } from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import { useState } from 'react'

export default function Page({
  searchParams,
}: {
  searchParams: { id?: string; org?: string }
}) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [showMessage, setShowMessage] = useState(false)

  const onUnsubscribe = async () => {
    if (!searchParams.id) {
      return
    }

    setLoading(true)

    api.articles
      .emailUnsubscribe({
        articleSubscriptionId: searchParams.id,
      })
      .then(() => {
        setShowMessage(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  if (!searchParams.id || !searchParams.org) {
    return <div>Sorry, we could not unsubscribe you.</div>
  }

  return (
    <div className="flex h-full w-full justify-center pt-8">
      <div>
        <ShadowBox>
          <div className="flex max-w-[400px] flex-col gap-4">
            <h2 className="font-semibold">
              Unsubscribe from emails from {searchParams.org}
            </h2>

            {showMessage ? (
              <Banner color="blue">You&apos;ve been unsubscribed.</Banner>
            ) : null}

            <div className="flex gap-4">
              <Button onClick={onUnsubscribe} loading={loading}>
                Yes, unsubscribe me
              </Button>
              <Button
                onClick={() => {
                  router.push(`/${searchParams.org}`)
                }}
                variant={'secondary'}
              >
                No, I changed my mind
              </Button>
            </div>

            <hr className="my-6" />

            <p className="text-sm">
              This will not cancel any paid subscriptions or unsubscribe you
              from other subscription benefits.
            </p>

            <p className="text-sm">
              <Link
                href={`/${searchParams.org}?tab=subscriptions`}
                className="text-underline text-blue-500"
              >
                Manage my subscription.
              </Link>
            </p>
          </div>
        </ShadowBox>
      </div>
    </div>
  )
}
