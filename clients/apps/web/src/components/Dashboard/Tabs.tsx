const Tabs = ({ children }: { children: React.ReactElement<any> }) => {
  return (
    <div className="dark:bg-polar-700 flex w-full justify-between space-x-1.5 rounded-lg bg-gray-200/75 p-1.5">
      {children}
    </div>
  )
}
export default Tabs
