import Link from 'next/link'
import { LogoType70 } from 'polarkit/components/brand'
import { Button } from 'polarkit/components/ui/atoms'

export default function Page({
  searchParams: { message, return_to },
}: {
  searchParams: { message: string; return_to: string }
}) {
  return (
    <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-[#FEFDF9]">
      <div id="polar-bg-gradient"></div>
      <div className="flex w-80 flex-col items-center gap-6 text-center">
        <LogoType70 className="h-10" />
        <h1 className="text-3xl">Oh no!</h1>
        <p>{message}</p>
        <Button asChild>
          <Link href={return_to}>Go back</Link>
        </Button>
      </div>
    </div>
  )
}
