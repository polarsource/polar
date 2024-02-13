import { Article } from '@polar-sh/sdk'
import { CONFIG } from 'polarkit'
import { twMerge } from 'tailwind-merge'
import { hasContent } from '../markdown'

const Paywall = (props: {
  children?: React.ReactNode
  showPaywalledContent: boolean
  isSubscriber: boolean
  article: Article
  paidArticlesBenefitName?: string
  renderer?: typeof BrowserPaywall
}) => {
  if (props.renderer) {
    const C = props.renderer
    return (
      <C
        showPaywalledContent={props.showPaywalledContent}
        isSubscriber={props.isSubscriber}
        article={props.article}
        paidArticlesBenefitName={props.paidArticlesBenefitName}
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
      paidArticlesBenefitName={props.paidArticlesBenefitName}
    >
      {props.children}
    </BrowserPaywall>
  )
}

const BasePaywall = (props: {
  linkRenderer: (props: {
    href: string
    children?: React.ReactNode
  }) => JSX.Element
  showPaywalledContent: boolean
  paidArticlesBenefitName?: string
  isSubscriber: boolean
  article: Article
  children?: React.ReactNode
  classNames?: string
}) => {
  const LinkRenderer = props.linkRenderer

  if (
    props.showPaywalledContent === false ||
    !props.children ||
    !hasContent(props.children)
  ) {
    return (
      <div
        className={twMerge(
          'my-4 flex flex-col items-center rounded-3xl bg-gray-100 px-8 py-4 text-center',
          props.classNames,
        )}
      >
        {props.isSubscriber ? (
          <p>
            This section is for premium subscribers only. Upgrade{' '}
            <LinkRenderer
              href={`${props.article.organization.name}/subscriptions`}
            >
              your subscription
            </LinkRenderer>{' '}
            to a tier with the &quot;
            {props.paidArticlesBenefitName ?? 'Premium Articles'}&quot; benefit
            to get access to it.
          </p>
        ) : (
          <p>
            This section is for premium subscribers only. Subscribe to{' '}
            <LinkRenderer
              href={`/${props.article.organization.name}/subscriptions`}
            >
              {props.article.organization.pretty_name ||
                props.article.organization.name}
            </LinkRenderer>{' '}
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
  paidArticlesBenefitName?: string
}) => {
  const linkRenderer = (props: {
    href: string
    children?: React.ReactNode
  }) => {
    return (
      <>
        <a
          className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
          href={props.href}
        >
          {props.children}
        </a>
      </>
    )
  }
  return (
    <BasePaywall
      {...props}
      linkRenderer={linkRenderer}
      classNames="dark:bg-polar-700"
    />
  )
}

export const EmailPaywall = (props: {
  showPaywalledContent: boolean
  isSubscriber: boolean
  article: Article
  children?: React.ReactNode
  paidArticlesBenefitName?: string
}) => {
  const linkRenderer = (props: {
    href: string
    children?: React.ReactNode
  }) => {
    return (
      <>
        {/* Use real <a> tag and absolute URL so it works properly in email rendering */}
        <a
          className="text-blue-500 hover:text-blue-400"
          href={`${CONFIG.FRONTEND_BASE_URL}/${props.href}`}
        >
          {props.children}
        </a>
      </>
    )
  }
  return <BasePaywall linkRenderer={linkRenderer} {...props} />
}

export default Paywall
