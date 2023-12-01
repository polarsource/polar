import React from 'react'
import Poll from './Poll'

// strictCreateElement removes unsupported types and attributes
const strictCreateElement = (
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
    return null
  }

  type = type.toLowerCase()

  if (!allowedTypes.includes(type)) {
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
}

export const markdownOpts = {
  disableParsingRawHTML: false,
  overrides: {
    poll: Poll,
    // example style overrides
    img: (args: any) => <img {...args} style={{ maxWidth: '100%' }} />,
  },
  createElement: strictCreateElement,
} as const
