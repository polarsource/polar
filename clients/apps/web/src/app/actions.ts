'use server'

import { revalidateTag } from 'next/cache'

export default async function revalidate(
  tag: string,
  cacheProfile: string = 'default',
) {
  revalidateTag(tag, cacheProfile)
}
