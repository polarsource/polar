const ShadowListGroup: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="dark:ring-polar-700 dark:bg-polar-800 w-full overflow-hidden rounded-2xl bg-transparent ring-1 ring-gray-200 dark:ring-1">
    {children}
  </div>
)

const ShadowListGroupItem: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <div className="dark:border-polar-700 border-t border-gray-200 p-5 first:border-t-0">
    {children}
  </div>
)

export default Object.assign(ShadowListGroup, {
  Item: ShadowListGroupItem,
})
