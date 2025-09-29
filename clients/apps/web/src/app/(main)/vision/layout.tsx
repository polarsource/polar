export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-polar-900 text-polar-100 box-border flex h-full max-h-screen w-full flex-col p-4 font-mono text-sm md:h-screen md:w-screen md:p-8">
      {children}
    </div>
  )
}
