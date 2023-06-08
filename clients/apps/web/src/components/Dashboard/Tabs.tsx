const Tabs = ({ children }: { children: React.ReactElement }) => {
  return (
    <div className="flex w-full justify-between space-x-1.5 rounded-lg bg-gray-200/75 p-1.5 dark:bg-gray-700">
      {children}
    </div>
  )
}
export default Tabs
