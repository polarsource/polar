import { PropsWithChildren } from 'react'

export function List({ children }: PropsWithChildren<{}>) {
  return <ul className="list-disc space-y-1 pl-6">{children}</ul>
}

export default List
