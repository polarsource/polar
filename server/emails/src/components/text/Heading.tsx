import { Heading as ReactEmailHeading } from 'react-email'
import { PropsWithChildren } from 'react'

export function Heading({ children }: PropsWithChildren<{}>) {
  return (
    <ReactEmailHeading className="mt-0 mb-2 text-lg font-bold text-gray-900">
      {children}
    </ReactEmailHeading>
  )
}

export default Heading
