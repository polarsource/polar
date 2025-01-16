export default function PitchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-polar-900 text-polar-100 flex h-screen w-screen flex-col overflow-auto p-12 font-mono text-sm">
      {children}
    </div>
  )
}
