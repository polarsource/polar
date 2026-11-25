'use server'

import { refresh, revalidateTag } from 'next/cache'

export async function refreshUser() {
  refresh()
}

export async function refreshOrganization(slug: string) {
  refresh()
  revalidateTag(`organizations:${slug}`, { expire: 0 })
}

export default async function revalidate(
  tag: Parameters<typeof revalidateTag>[0],
  cacheProfile: Parameters<typeof revalidateTag>[1] = 'default',
) {
  revalidateTag(tag, cacheProfile)
}
