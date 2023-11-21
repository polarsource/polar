'use client'

import Editor from '@/components/Feed/Editor'
import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import { useParams, useRouter } from 'next/navigation'
import { Button, Input } from 'polarkit/components/ui/atoms'
import { useSubscriptionTiers } from 'polarkit/hooks'
import { useCallback, useState } from 'react'

const ClientPage = () => {
  const { organization } = useParams()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const router = useRouter()

  const handleSave = useCallback(async () => {
    router.push(`/maintainer/${organization}/posts`)
  }, [router, organization])

  const subscriptionTiers = useSubscriptionTiers(organization as string)

  return (
    <>
      <DashboardBody>
        <div className="flex h-full flex-row">
          <div className="flex h-full w-full flex-col items-start gap-y-8">
            <div className="flex w-full flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                Create Post
              </h3>

              <div className="flex flex-row items-center gap-x-4">
                <Button variant="secondary" onClick={handleSave}>
                  Save Draft
                </Button>
                <Button onClick={handleSave}>Publish</Button>
              </div>
            </div>
            <Input
              className="min-w-[320px]"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="flex h-full w-full flex-col">
              <Editor value={body} onChange={setBody} />
            </div>
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

export default ClientPage
