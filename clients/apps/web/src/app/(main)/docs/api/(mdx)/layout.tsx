import APILayout from '@/components/Documentation/APILayout'
import { fetchSchema } from '@/components/Documentation/openapi'

export const dynamic = 'force-static'
export const dynamicParams = false

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const openAPISchema = await fetchSchema()
  return <APILayout openAPISchema={openAPISchema}>{children}</APILayout>
}
