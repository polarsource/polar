'use server'

import { revalidateTag } from 'next/cache'

export default async function revalidate(
  tag: Parameters<typeof revalidateTag>[0],
  cacheProfile: Parameters<typeof revalidateTag>[1] = 'default',
) {
  revalidateTag(tag, cacheProfile)
}
