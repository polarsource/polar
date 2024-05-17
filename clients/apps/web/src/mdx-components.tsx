import type { MDXComponents } from 'mdx/types'
import React from 'react'

const iterateOverChildren = (
  children: React.ReactNode | React.ReactNode[],
  text: string[],
) => {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string' && child !== '\n') {
      text.push(child)
    }

    if (!React.isValidElement(child)) {
      return text
    }

    return iterateOverChildren(child.props.children, text)
  })
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    blockquote: ({ children }) => {
      console.log(iterateOverChildren(children, []))

      return (
        <blockquote className="my-4 border-l-4 border-gray-300 py-2 pl-4 dark:border-gray-700">
          {children}
        </blockquote>
      )
    },
  }
}
