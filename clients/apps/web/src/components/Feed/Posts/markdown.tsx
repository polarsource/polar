import React from 'react'

const Poll = (props: { children?: React.ReactNode }) => (
  <div className="bg-blue-300 p-8">
    This is a Poll!
    {props.children ? 'has child' : 'no child'}
  </div>
)

export const markdownOpts = {
  disableParsingRawHTML: false,
  overrides: {
    Poll,
    poll: Poll,
  },
  createElement: (
    type:
      | string
      | import('react').FunctionComponent<{}>
      | import('react').ComponentClass<{}, any>,
    props: JSX.IntrinsicAttributes | any,
    children: any,
  ): JSX.Element | null => {
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

      return React.createElement(type, props, children)
    }

    if (typeof type !== 'string') {
      console.log('Dropped', type)
      return null
    }

    type = type.toLowerCase()

    if (!allowedTypes.includes(type)) {
      console.log('Dropped', type)
      return null
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
        return null
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
  },
} as const
