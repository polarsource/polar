const CircledNumber = ({ children }: { children: React.ReactNode }) => (
  <div className="dark:border-polar-500 m-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-around rounded-full border border-gray-200">
    <span className="text-sm">{children}</span>
  </div>
)

export default CircledNumber
