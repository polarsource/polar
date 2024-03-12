import { AdvertisementDisplay, Article } from '@polar-sh/sdk'
import React, { Fragment } from 'react'
import * as ReactIs from 'react-is'

export type RenderArticle = Pick<
  Article,
  | 'title'
  | 'body'
  | 'published_at'
  | 'byline'
  | 'organization'
  | 'slug'
  | 'is_preview'
>

export type BenefitAds = {
  benefitId: string
  ads: Array<AdvertisementDisplay>
}

// strictCreateElement removes unsupported types and attributes
export const wrapStrictCreateElement = (args: {
  article: RenderArticle
  showPaywalledContent?: boolean
  isSubscriber?: boolean
  paidArticlesBenefitName?: string
  defaultOverride?: React.FunctionComponent
  extraAllowedCustomComponents?: string[]
  adsContext?: BenefitAds[]
}): ((
  type: string | React.FunctionComponent<{}> | React.ComponentClass<{}, any>,
  props: JSX.IntrinsicAttributes | any,
  ...children: React.ReactNode[]
) => JSX.Element) => {
  let globalIdx = 0

  const strictCreateElement = (
    type: string | React.FunctionComponent<{}> | React.ComponentClass<{}, any>,
    props: JSX.IntrinsicAttributes | any,
    ...children: React.ReactNode[]
  ): JSX.Element => {
    const retNode = (node: React.ReactNode): JSX.Element => {
      if (!node) {
        return <></>
      }

      if (Array.isArray(node) && node.length === 0) {
        return <></>
      }

      if (Array.isArray(node) && node.length === 1) {
        return node[0]
      }

      if (Array.isArray(node)) {
        return (
          <Fragment>
            {node.map((ch) => (
              <Fragment key={globalIdx++}>{retNode(ch)}</Fragment>
            ))}
          </Fragment>
        )
      }

      return <Fragment key={globalIdx++}>{node}</Fragment>
    }

    const ret = (
      type:
        | string
        | React.FunctionComponent<{}>
        | React.ComponentClass<{}, any>,
      props: JSX.IntrinsicAttributes | any,
      children: React.ReactNode[] | React.ReactNode | undefined,
    ): JSX.Element => {
      if (Array.isArray(children)) {
        return React.createElement(
          type,
          props,
          <Fragment>
            {children.map((ch) => (
              <Fragment key={globalIdx++}>{retNode(ch)}</Fragment>
            ))}
          </Fragment>,
        )
      }
      if (children) {
        return React.createElement(
          type,
          {
            ...props,
          } as JSX.IntrinsicAttributes,
          children,
        )
      } else {
        return React.createElement(type, {
          ...props,
        } as JSX.IntrinsicAttributes)
      }
    }

    const allowedTypes = [
      'a',
      'b',
      'blockquote',
      'code',
      'del',
      'div',
      'em',
      'footer',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'img',
      'input',
      'li',
      'ol',
      'p',
      'picture',
      'pre',
      'source',
      'span',
      'strong',
      'sub',
      'sup',
      'table',
      'tbody',
      'td',
      'th',
      'thead',
      'tr',
      'ul',
      'br',
      'figure',
      'figcaption',
    ]

    // clean up props, only pass down a limited set of safe props
    let trimProps: typeof props = {
      key: props?.key,
      style: props?.style,
      align: props?.align,
      className: props?.className,
      id: props?.id,
    }

    let trimChildren: typeof children | undefined = children

    const allowedCustomComponents = [
      // custom completely overridden components
      'embed',
      'iframe',
      'img',
      'pre',
      // our custom components
      'poll',
      'paywall',
      'subscribenow',
      ...(args.extraAllowedCustomComponents ?? []),
    ].map((s) => s.toLowerCase())

    // Custom components
    if (
      typeof type === 'function' &&
      type?.name &&
      allowedCustomComponents.includes(type?.name.toLowerCase())
    ) {
      const customComponentName = type?.name.toLowerCase()

      if (customComponentName === 'img') {
        if (typeof props.src !== 'string') {
          return <></>
        }
        if (
          !props.src.startsWith('https://') &&
          !props.src.startsWith('http://')
        ) {
          return <></>
        }

        trimProps.src = props?.src
        trimProps.height = props?.height
        trimProps.width = props?.width
        trimProps.alt = props?.alt
        trimChildren = undefined // can never have children
      }

      if (customComponentName === 'embed') {
        trimProps.src = props?.src
        trimChildren = undefined // can never have children
      }

      if (customComponentName === 'iframe') {
        trimProps.src = props?.src
        trimProps.title = props?.title
        trimProps.allow = props?.allow
        trimChildren = undefined // can never have children
      }

      if (['subscribenow', 'paywall'].includes(customComponentName)) {
        trimProps.article = args.article
        // Default to true in the client side renderer. When rendering posts for end-users, the premium content is already stripped out by the backend.
        trimProps.showPaywalledContent = args.showPaywalledContent ?? true
        trimProps.isSubscriber = args.isSubscriber ?? false
        trimProps.paidArticlesBenefitName = args.paidArticlesBenefitName
      }

      if (customComponentName === 'ad') {
        trimProps.subscriptionBenefitId = props?.subscriptionBenefitId
        trimProps.adsContext = args.adsContext
      }

      if (Array.isArray(trimChildren) && trimChildren.length === 0) {
        trimChildren = undefined
      }

      return ret(type, trimProps, trimChildren)
    }

    if (typeof type !== 'string') {
      return <></>
    }

    type = type.toLowerCase()

    if (!allowedTypes.includes(type)) {
      return <></>
    }

    if (args.defaultOverride) {
      return React.createElement(args.defaultOverride, {}, trimChildren)
    }

    if (type === 'a') {
      const href = props?.href
      if (
        typeof href === 'string' &&
        // Restricted protos.
        // Do not allow relative URLs.
        (href.startsWith('https://') ||
          href.startsWith('http://') ||
          href.startsWith('mailto://') ||
          href.startsWith('#'))
      ) {
        trimProps.href = props?.href
      } else {
        return <></>
      }
    }

    if (type === 'input') {
      if (props?.type !== 'checkbox') {
        return <></>
      }

      trimProps.type = 'checkbox'
      trimProps.checked = props?.checked
      trimProps.disabled = 'disabled'
      trimChildren = undefined // can never have children
    }

    if (type === 'source') {
      trimProps.media = props?.media
      trimProps.srcSet = props?.srcSet
    }

    if (Array.isArray(trimChildren) && trimChildren.length === 0) {
      trimChildren = undefined
    }

    return ret(type, trimProps, trimChildren)
  }

  return strictCreateElement
}

export const markdownOpts = {
  disableParsingRawHTML: false,
  forceBlock: true,
  overrides: {
    // Do not render by default.
    // The web and email renderers will register their corresponding implementations
    poll: () => <></>,
    Paywall: () => <></>,
    SubscribeNow: () => <></>,
    embed: () => <></>,
    iframe: () => <></>,

    // example style overrides
    img: (args: any) => <img {...args} style={{ maxWidth: '100%' }} />,
  },
} as const

// hasContent detects if node has any content recursively
// It walks through multiple layers of Fragments to see if there is any non-empty Fragment
export const hasContent = (node: React.ReactNode): boolean => {
  if (!node) {
    return false
  }

  if (node && typeof node === 'object' && 'key' in node) {
    if ('children' in node.props) {
      if (Array.isArray(node.props.children)) {
        for (const ch of node.props.children) {
          if (hasContent(ch)) {
            return true
          }
        }
      } else {
        const ch = node.props.children

        if (ReactIs.isFragment(ch)) {
          if (hasContent(ch)) {
            return true
          }
        } else {
          if (ReactIs.isElement(ch) || typeof ch === 'string') {
            return true
          }
        }
      }
    }
  }

  return false
}

export const firstChild = (
  node: React.ReactNode,
): React.ReactNode | undefined => {
  if (!node) {
    return undefined
  }

  if (node && Array.isArray(node)) {
    for (const ch of node) {
      const c = firstChild(ch)
      if (c !== undefined) {
        return c
      }
    }
    return undefined
  }

  if (ReactIs.isFragment(node)) {
    return firstChild(node.props.children)
  }

  if (node) {
    return node
  }

  return undefined
}
