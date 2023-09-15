const ShadowListGroup: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="w-full rounded-xl bg-white shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-700">
    {children}
  </div>
)

const ShadowListGroupItem: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <div className="border-t border-gray-200 p-5 first:border-t-0 dark:border-gray-700">
    {children}
  </div>
)

export default Object.assign(ShadowListGroup, {
  Item: ShadowListGroupItem,
})
