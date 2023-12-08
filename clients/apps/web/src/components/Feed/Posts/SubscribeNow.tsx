import { useAuth } from '@/hooks/auth'
import { Article } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button } from 'polarkit/components/ui/atoms'
import { useUserSubscriptions } from 'polarkit/hooks'

const SubscribeNow = (props: { article: Article }) => {
  const { currentUser } = useAuth()

  const userSubs = useUserSubscriptions(
    currentUser?.id,
    props.article.organization.name,
    true,
    30,
    props.article.organization.platform,
  )

  const router = useRouter()

  // User is already subscribed, hide button.
  if (userSubs.data?.items && userSubs.data?.items.length > 0) {
    return <></>
  }

  return (
    <div className="flex flex-col items-center py-1">
      <Button
        onClick={() => {
          router.push(`/${props.article.organization.name}?tab=subscriptions`)
        }}
      >
        Subscribe to{' '}
        {props.article.organization.pretty_name ||
          props.article.organization.name}
      </Button>
    </div>
  )
}

export default SubscribeNow
