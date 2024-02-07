import SubscribeNowWithModal from '@/components/Subscriptions/SubscribeNowWithModal'
import { Article } from '@polar-sh/sdk'

const SubscribeNow = (props: { article: Article; isSubscriber: boolean }) => {
  return (
    <SubscribeNowWithModal
      organization={props.article.organization}
      isSubscriber={props.isSubscriber}
    />
  )
}

export default SubscribeNow
