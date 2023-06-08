const BalanceBadgeBox = ({
  children,
  withIcon,
}: {
  children: React.ReactElement
  withIcon?: boolean
}) => {
  const padding = withIcon ? 'pr-1.5' : 'pr-3'
  return (
    <div
      className={`inline-flex items-center space-x-3 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 text-sm font-medium text-blue-600 transition-all duration-200 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-200 dark:hover:border-blue-700 dark:hover:bg-blue-800 ${padding}`}
    >
      {children}
    </div>
  )
}
export default BalanceBadgeBox
