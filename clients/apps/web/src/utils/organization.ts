import { notFound } from 'next/navigation'
import { getUserOrganizations } from '@/utils/user'

export const getOrganizationBySlug = async (slug: string) => {
  const organizations = await getUserOrganizations()
  return organizations.find((organization) => organization.slug === slug)
}

export const getOrganizationBySlugOrNotFound = async (slug: string) =>
  (await getOrganizationBySlug(slug)) ?? notFound()
