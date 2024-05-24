import type { MDXComponents } from 'mdx/types'
import { HeadingObserver } from './components/Documentation/HeadingObserver'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    h1: (props) => <HeadingObserver type="h1" {...props} />,
    h2: (props) => <HeadingObserver type="h2" {...props} />,
    h3: (props) => <HeadingObserver type="h3" {...props} />,
    h4: (props) => <HeadingObserver type="h4" {...props} />,
    h5: (props) => <HeadingObserver type="h5" {...props} />,
    h6: (props) => <HeadingObserver type="h6" {...props} />,
  }
}
