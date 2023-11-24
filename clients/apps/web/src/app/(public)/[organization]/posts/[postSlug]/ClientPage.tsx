import LongformPost from '@/components/Feed/LongformPost'
import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { Article } from '@polar-sh/sdk'
import Link from 'next/link'
import { LogoType } from 'polarkit/components/brand'

export default function Page({ post }: { post: Article }) {
  return (
    <div className="flex w-full flex-col items-center gap-y-16">
      <div className="flex w-full flex-row items-center justify-between px-4">
        <Link href="/">
          <LogoType />
        </Link>
        <div>
          <ProfileMenu />
        </div>
      </div>
      <LongformPost post={post} />
    </div>
  )
}
