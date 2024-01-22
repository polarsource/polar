import { Article } from '@polar-sh/sdk'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

const Paywall = (props: {
  children?: React.ReactNode
  showPaywalledContent: boolean
  isSubscriber: boolean
  article: Article
  renderer?: typeof BrowserPaywall
}) => {
  if (props.renderer) {
    const C = props.renderer
    return (
      <C
        showPaywalledContent={props.showPaywalledContent}
        isSubscriber={props.isSubscriber}
        article={props.article}
      >
        {props.children}
      </C>
    )
  }

  return (
    <BrowserPaywall
      showPaywalledContent={props.showPaywalledContent}
      isSubscriber={props.isSubscriber}
      article={props.article}
    >
      {props.children}
    </BrowserPaywall>
  )
}

const BasePaywall = (props: {
  showPaywalledContent: boolean
  isSubscriber: boolean
  article: Article
  children?: React.ReactNode
  classNames?: string
}) => {
  if (
    props.showPaywalledContent === false ||
    !props.children ||
    (Array.isArray(props.children) && props.children.length === 0)
  ) {
    return (
      <div
        className={twMerge(
          'my-4 flex flex-col items-center rounded-3xl bg-gray-100 px-8 py-4',
          props.classNames,
        )}
      >
        {props.isSubscriber ? (
          <p>
            This section is for premium subscribers only. Upgrade{' '}
            <Link
              className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
              href={`/${props.article.organization.name}/subscriptions`}
            >
              your subscription
            </Link>{' '}
            to a tier with the &quot;Paid Subscription&quot; benefit to get
            access to it.
          </p>
        ) : (
          <p>
            This section is for premium subscribers only. Subscribe to{' '}
            <Link
              className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
              href={`/${props.article.organization.name}/subscriptions`}
            >
              {props.article.organization.pretty_name ||
                props.article.organization.name}
            </Link>{' '}
            to get access to it.
          </p>
        )}
      </div>
    )
  }
  return <p>{props.children}</p>
}

const BrowserPaywall = (props: {
  showPaywalledContent: boolean
  isSubscriber: boolean
  article: Article
  children?: React.ReactNode
}) => {
  return <BasePaywall {...props} classNames="dark:bg-polar-700" />
}

export const EmailPaywall = (props: {
  showPaywalledContent: boolean
  isSubscriber: boolean
  article: Article
  children?: React.ReactNode
}) => {
  return <BasePaywall {...props} />
}

export default Paywall
