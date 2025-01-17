export default function PitchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-polar-900 text-polar-100 flex h-full min-h-screen w-full flex-col overflow-auto p-4 font-mono text-sm md:h-screen md:w-screen md:p-12">
      {children}
    </div>
  )
}
