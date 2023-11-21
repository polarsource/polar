import { Post } from '@/components/Feed/data'
import ProfileSelection from '@/components/Shared/ProfileSelection'
import Link from 'next/link'
import { LogoType } from 'polarkit/components/brand'
import LongformPost from '../../../../../components/Feed/LongformPost'

export default function Page({ post }: { post: Post }) {
  return (
    <div className="flex w-full flex-col items-center gap-y-16">
      <div className="flex w-full flex-row items-center justify-between px-4">
        <Link href="/">
          <LogoType />
        </Link>
        <div>
          <ProfileSelection className="w-[300px] border border-gray-100 shadow-sm" />
        </div>
      </div>
      <LongformPost post={post} />
    </div>
  )
}
