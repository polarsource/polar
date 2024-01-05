import { Feed } from '@/components/Feed/Feed'

export default async function Page() {
  return (
    <div className="relative flex flex-row items-start gap-x-24">
      <div className="flex w-full max-w-xl flex-col gap-y-8 pb-12">
        <Feed />
      </div>
    </div>
  )
}
