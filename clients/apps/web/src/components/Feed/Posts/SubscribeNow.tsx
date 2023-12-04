import { Article } from '@polar-sh/sdk'
import { Button } from 'polarkit/components/ui/atoms'

const SubscribeNow = (props: { article: Article }) => {
  return (
    <div className="flex flex-col items-center py-1">
      <Button onClick={() => 'TODO!'}>
        Subscribe to{' '}
        {props.article.organization.pretty_name ||
          props.article.organization.name}
      </Button>
    </div>
  )
}

export default SubscribeNow
