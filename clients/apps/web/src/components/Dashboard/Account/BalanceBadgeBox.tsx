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
      className={`inline-flex items-center space-x-3 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 text-sm text-blue-600 transition-all duration-200 hover:bg-blue-100 ${padding}`}
    >
      {children}
    </div>
  )
}
export default BalanceBadgeBox
