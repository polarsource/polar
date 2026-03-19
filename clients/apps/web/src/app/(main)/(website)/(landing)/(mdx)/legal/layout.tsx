import { ArticleLayout } from '@/components/Layout/Public/ArticleLayout'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ArticleLayout>{children}</ArticleLayout>
}
