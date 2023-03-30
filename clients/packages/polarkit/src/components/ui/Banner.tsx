const GreenBanner = ({ children }: { children: React.ReactElement }) => {
  return (
    <div className="rounded-md border-2 border-green-400 bg-green-200 px-4 py-2 text-sm font-medium text-green-800">
      {children}
    </div>
  )
}

const RedBanner = ({ children }: { children: React.ReactElement }) => {
  return (
    <div className="rounded-md border-2 border-red-400 bg-red-200 px-4 py-2 text-sm font-medium text-red-800">
      {children}
    </div>
  )
}

export { GreenBanner, RedBanner }
