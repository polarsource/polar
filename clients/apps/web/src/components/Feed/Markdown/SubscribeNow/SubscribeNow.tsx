import { CheckIcon } from '@heroicons/react/24/outline'
import { Article } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button } from 'polarkit/components/ui/atoms'

const SubscribeNow = (props: { article: Article; isSubscriber: boolean }) => {
  const router = useRouter()

  if (props.isSubscriber) {
    return (
      <div className="flex flex-col items-center py-1">
        <Button disabled={true}>
          <CheckIcon className="-ml-1 mr-2 h-4 w-4" /> Subscribed
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-1">
      <Button
        onClick={() => {
          router.push(`/${props.article.organization.name}/subscriptions`)
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
