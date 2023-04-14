const Tabs = ({ children }) => {
  return (
    <div className="flex w-full justify-between space-x-1.5 rounded-lg bg-gray-200/75 p-1.5">
      {children}
    </div>
  )
}
export default Tabs
