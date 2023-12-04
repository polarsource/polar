import { Article } from '@polar-sh/sdk'
import React from 'react'

// strictCreateElement removes unsupported types and attributes
export const wrapStrictCreateElement = (
  article: Article,
): ((
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
      // our custom components
      'poll',
      'paywall',
      'subscribenow',
    ]

    // clean up props, only pass down a limited set of safe props
    let trimProps: typeof props = {
      key: props?.key,
      style: props?.style,
      align: props?.align,
    }

    // Custom components
    if (typeof type === 'function') {
      // todo: validate
      console.log('custom component', {
        type,
        props,
        children,
      })

      return React.createElement(
        type,
        // dependency inject article to all custom components
        { article: article } as JSX.IntrinsicAttributes,
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

    if (type === 'img') {
      trimProps.src = props?.src
      trimProps.height = props?.height
      trimProps.width = props?.width
      children = undefined // can never have children
    }

    if (type === 'a') {
      // TODO: parse and validate href
      // Double check protocols
      trimProps.href = props?.href
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
    paywall: () => <></>,
    SubscribeNow: () => <></>,

    // example style overrides
    img: (args: any) => <img {...args} style={{ maxWidth: '100%' }} />,
  },
  // createElement: wrapStrictCreateElement(),
} as const
