export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mb:mt-12 mb:mb-24 mx-auto mb-16 flex w-full max-w-[970px] flex-col space-y-8 px-2 md:space-y-12 lg:px-0">
      {children}
    </div>
  )
}
