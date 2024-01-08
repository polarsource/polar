import { Article } from '@polar-sh/sdk'
import React from 'react'

export type RenderArticle = Pick<
  Article,
  'title' | 'body' | 'published_at' | 'byline' | 'organization'
>

// strictCreateElement removes unsupported types and attributes
export const wrapStrictCreateElement = (args: {
  article: RenderArticle
  showPaywalledContent?: boolean
  isSubscriber?: boolean
  defaultOverride?: React.FunctionComponent
}): ((
  type:
    | string
    | import('react').FunctionComponent<{}>
    | import('react').ComponentClass<{}, any>,
  props: JSX.IntrinsicAttributes | any,
  children: any,
) => JSX.Element) => {
  const strictCreateElement = (
    type:
      | string
      | import('react').FunctionComponent<{}>
      | import('react').ComponentClass<{}, any>,
    props: JSX.IntrinsicAttributes | any,
    children: any,
  ): JSX.Element => {
    const allowedTypes = [
      'a',
      'b',
      'blockquote',
      'code',
      'del',
      'div',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'img',
      'p',
      'pre',
      'strong',
      'sup',
      'table',
      'tbody',
      'th',
      'thead',
      'tr',
      'td',
      'li',
      'ul',
      'ol',
      'footer',
      'hr',
      'span',
      'input',
    ]

    // clean up props, only pass down a limited set of safe props
    let trimProps: typeof props = {
      key: props?.key,
      style: props?.style,
      align: props?.align,
      className: props?.className,
    }

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
    ]

    // Custom components
    if (
      typeof type === 'function' &&
      type?.name &&
      allowedCustomComponents.includes(type?.name.toLocaleLowerCase())
    ) {
      const customComponentName = type?.name.toLocaleLowerCase()

      if (customComponentName === 'img') {
        trimProps.src = props?.src
        trimProps.height = props?.height
        trimProps.width = props?.width
        children = undefined // can never have children
      }

      if (customComponentName === 'embed') {
        trimProps.src = props?.src
        children = undefined // can never have children
      }

      if (customComponentName === 'iframe') {
        trimProps.src = props?.src
        trimProps.title = props?.title
        trimProps.allow = props?.allow
        children = undefined // can never have children
      }

      return React.createElement(
        type,

        {
          ...trimProps,

          // Dependency inject article to all components
          article: args.article,

          // Default to true in the client side renderer. When rendering posts for end-users, the premium content is already stripped out by the backend.
          showPaywalledContent: args.showPaywalledContent ?? true,
          isSubscriber: args.isSubscriber ?? false,
        } as JSX.IntrinsicAttributes,
        children,
      )
    }

    if (typeof type !== 'string') {
      return <></>
    }

    type = type.toLowerCase()

    if (!allowedTypes.includes(type)) {
      return <></>
    }

    if (args.defaultOverride) {
      return React.createElement(args.defaultOverride, {}, props.children)
    }

    if (type === 'a') {
      const href = props?.href
      if (
        typeof href === 'string' &&
        // Restricted protos.
        // Do not allow relative URLs.
        (href.startsWith('https://') ||
          href.startsWith('http://') ||
          href.startsWith('mailto://'))
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
      children = undefined // can never have children
    }

    return React.createElement(
      type,

      trimProps,
      children,
    )
  }

  return strictCreateElement
}

export const markdownOpts = {
  disableParsingRawHTML: false,
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
