const ShadowListGroup: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="dark:bg-polar-900 dark:ring-polar-700 w-full rounded-xl bg-white shadow-sm ring-1 ring-gray-100 dark:ring-1">
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
