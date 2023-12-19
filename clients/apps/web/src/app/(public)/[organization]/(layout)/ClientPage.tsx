'use client'

import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { Modal, ModalHeader } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import IssuesLookingForFunding from '@/components/Organization/IssuesLookingForFunding'
import Spinner from '@/components/Shared/Spinner'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { useAuth } from '@/hooks'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { RssIcon } from '@heroicons/react/24/outline'
import { Article, CreatePersonalAccessTokenResponse, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { api } from 'polarkit/api'
import { Button, CopyToClipboardInput, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { useEffect, useRef, useState } from 'react'

const ClientPage = ({
  organization,
  posts,
}: {
  organization: Organization
  posts: Article[]
}) => {

  const {
    isShown: rssModalIsShown,
    hide: hideRssModal,
    show: showRssModal,
  } = useModal() 

  return isFeatureEnabled('feed') ? (
    <>
    <StaggerReveal className="flex max-w-xl flex-col gap-y-6">
      {posts.map((post) => (
        <StaggerReveal.Child key={post.id}>
          <PostComponent article={post} />
        </StaggerReveal.Child>
      ))}
      <div>
      <Button fullWidth={false} onClick={showRssModal} variant={"outline"}>
        <RssIcon className='h-4 w-4 mr-2' />
        <span>RSS</span></Button>
      </div>
    </StaggerReveal>

    <Modal
        isShown={rssModalIsShown}
        hide={hideRssModal}
        modalContent={
          <RssModal
            hide={hideRssModal}
            organization={organization}
          />
        }
      />
    </>
  ) : (
    <ShadowBoxOnMd>
      <div className="p-4">
        <div className="flex flex-row items-start justify-between pb-8">
          <h2 className="text-lg font-medium">Issues looking for funding</h2>
        </div>
        <IssuesLookingForFunding organization={organization} />
      </div>
    </ShadowBoxOnMd>
  )
}

export default ClientPage


const RssModal = ({
  hide,
  organization,
}: {
  hide: () => void
  organization: Organization
}) => {

  const {currentUser} = useAuth()
  const [token, setToken] = useState<string>()
  const auth = token ? `?auth=${token}` : ''
  const url = `https://polar.sh/${organization.name}/rss${auth}`

  useEffect(() => {
    if (!currentUser) {
      return
    }

    let active = true

    api.personalAccessToken.create({
      createPersonalAccessToken: {
        comment: `RSS for ${organization.name}`,
        scopes: ["articles:read"],
      }
    }).then((res: CreatePersonalAccessTokenResponse) => {
      if (active) {
        setToken(res.token)
      }
    })

    return () => {
      active = false
    }
  }, [currentUser])

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={hide}>
        <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
          Subscribe to {organization.pretty_name || organization.name} via RSS
        </h3>
      </ModalHeader>
      <div className="p-8">
        <div className="flex flex-col gap-y-4">
          
          <div className="flex flex-col gap-y-2">
            <span className="font-medium">{currentUser ? 'Your feed URL' : 'Feed URL'}</span>
            {currentUser ? 
            <p className="text-polar-500 dark:text-polar-500 text-sm">
              This URL is personal, keep it safe.
            </p> : null}
          </div>



        {url ? <div className='flex items-center gap-2'>
          <CopyToClipboardInput value={url} id={'rssurl'} />
            <Link href={`feed:${url}`}>
          <Button asChild>Open</Button>
          </Link>
          </div> : <Spinner />}

          
        </div>
      </div>
    </>
  )
}