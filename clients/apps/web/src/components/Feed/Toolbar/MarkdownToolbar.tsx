import { Button } from 'polarkit/components/ui/atoms'
import { useMarkdownComponents } from './useMarkdownComponents'

export const MarkdownToolbar = () => {
  const { insertPaywall, insertSubscribeNow, insertAd } =
    useMarkdownComponents()

  return (
    <>
      <Button onClick={insertPaywall} size={'sm'} variant={'secondary'}>
        {'<Paywall />'}
      </Button>
      <Button onClick={insertSubscribeNow} size={'sm'} variant={'secondary'}>
        {'<SubscribeNow />'}
      </Button>
      <Button onClick={insertAd} size={'sm'} variant={'secondary'}>
        {'<Ad />'}
      </Button>
    </>
  )
}
