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
      className={`inline-flex items-center space-x-3 rounded-full border-2 border-[#E5DEF5] bg-[#F9F7FD] py-1 pl-3 text-[#7556BA] transition-colors duration-100 hover:bg-[#E5DEF5] ${padding}`}
    >
      {children}
    </div>
  )
}
export default BalanceBadgeBox
