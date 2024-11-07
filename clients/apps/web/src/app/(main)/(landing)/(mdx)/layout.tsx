export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-[100vw] flex-col gap-x-16 gap-y-16 px-4 py-4 pb-24 pt-16 md:max-w-7xl md:flex-row md:items-start md:justify-between md:px-12 md:py-24">
      {children}
    </div>
  )
}
