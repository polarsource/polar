interface ListProps {
  children: React.ReactNode
}

interface ListItemProps {
  children: React.ReactNode
}

function List({ children }: ListProps) {
  return <ul className="my-[16px] list-disc space-y-1 pl-6">{children}</ul>
}

function ListItem({ children }: ListItemProps) {
  return <li>{children}</li>
}

List.Item = ListItem

export { List }
export default List
