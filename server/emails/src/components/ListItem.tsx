import { PropsWithChildren } from 'react'

export function ListItem({ children }: PropsWithChildren<{}>) {
  return <li>{children}</li>
}

export default ListItem
