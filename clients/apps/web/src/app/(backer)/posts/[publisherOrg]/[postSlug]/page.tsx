'use client'

import LongformPost from '@/components/Feed/LongformPost'
import { ArrowBackOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { Button } from 'polarkit/components/ui/atoms'
import { useArticleLookup } from 'polarkit/hooks'

export default function Page({
  params,
}: {
  params: { publisherOrg: string; postSlug: string }
}) {
  const article = useArticleLookup(params.publisherOrg, params.postSlug)

  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 relative my-16 flex flex-row items-start rounded-3xl bg-white p-12 shadow-lg dark:border">
      <Link className="absolute left-16 top-16 flex-shrink" href="/posts">
        <Button
          size="sm"
          variant="secondary"
          className="group flex h-8 w-8 flex-col items-center justify-center rounded-full border"
        >
          <ArrowBackOutlined fontSize="inherit" />
        </Button>
      </Link>
      <div className="flex w-full flex-grow flex-col items-center gap-y-8 pb-12">
        {article.data ? (
          <LongformPost
            article={article.data}
            isSubscriber={true}
            showPaywalledContent={true} // Can safely be true. Content is already stripped out.
          />
        ) : null}
      </div>
    </div>
  )
}
