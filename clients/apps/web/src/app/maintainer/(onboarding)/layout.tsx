import LogoIcon from '@/components/Brand/LogoIcon'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12">
      <LogoIcon className="text-blue-500 dark:text-blue-400" size={50} />
      <div className="relative flex min-h-screen w-full flex-col items-center md:py-0">
        {children}
      </div>
    </div>
  )
}
