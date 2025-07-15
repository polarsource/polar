export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dark:bg-polar-900 flex h-full flex-col">{children}</div>
  )
}
