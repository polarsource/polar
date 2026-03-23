const ListGroup: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="dark:ring-polar-700 w-full overflow-hidden rounded-2xl bg-transparent ring-1 ring-gray-200 dark:ring-1">
    {children}
  </div>
)

const ListGroupItem: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="dark:border-polar-700 border-t border-gray-200 p-5 first:border-t-0">
    {children}
  </div>
)

export default Object.assign(ListGroup, {
  Item: ListGroupItem,
})
