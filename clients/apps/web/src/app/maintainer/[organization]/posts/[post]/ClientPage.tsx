'use client'

import Editor from '@/components/Feed/Editor'
import { posts } from '@/components/Feed/data'
import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import { ExpandMoreOutlined } from '@mui/icons-material'
import { useParams, useRouter } from 'next/navigation'
import { Button } from 'polarkit/components/ui/atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useSubscriptionTiers } from 'polarkit/hooks'
import { useCallback, useState } from 'react'

const ClientPage = () => {
  const { post: postId, organization } = useParams()
  const post = posts.find((post) => post.slug === postId)
  const router = useRouter()
  const [value, setValue] = useState(post?.text || '')

  const handleSave = useCallback(() => {
    router.push(`/maintainer/${organization}/posts`)
  }, [router, organization])

  const subscriptionTiers = useSubscriptionTiers(organization as string)

  return (
    <>
      <DashboardBody>
        <div className="items mb-24 flex flex-row items-start gap-x-12">
          <div className="flex w-3/4 flex-col gap-y-8">
            <div className="flex w-full flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                Edit Post
              </h3>
            </div>
            <div className="flex flex-col">
              <Editor value={value} onChange={setValue} />
            </div>
            <Button className="self-start" onClick={handleSave}>
              Save Post
            </Button>
          </div>
          <div className="flex w-1/4 flex-col gap-y-8">
            <h2 className="dark:text-polar-50 text-lg font-medium text-gray-950">
              Settings
            </h2>
            <div className="flex w-full flex-grow flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-md text-gray-950">
                Visibility
              </h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="self-start" variant="secondary">
                    <span className="flex-grow">Public</span>
                    <ExpandMoreOutlined className="ml-2" fontSize="small" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="dark:bg-polar-800 bg-gray-50 shadow-lg"
                  align="end"
                >
                  <DropdownMenuItem>
                    <span>Public</span>
                  </DropdownMenuItem>
                  {subscriptionTiers.data?.items?.map((tier) => (
                    <DropdownMenuItem key={tier.id}>
                      <span>{tier.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

export default ClientPage
