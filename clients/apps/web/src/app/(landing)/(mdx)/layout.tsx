export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4py-4 flex w-full max-w-[100vw] flex-col gap-x-16 gap-y-16 pb-24 pt-16 md:max-w-7xl md:flex-row md:items-start md:justify-between md:px-12 md:py-8 [&>_#toc]:top-28">
      {children}
    </div>
  )
}
