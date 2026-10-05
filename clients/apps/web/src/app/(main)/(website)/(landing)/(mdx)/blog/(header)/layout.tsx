import { ArticleLayout } from '@/components/Layout/Public/ArticleLayout'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ArticleLayout className="prose-p:mt-0 prose-p:mb-6 prose-h3:mt-8 prose-h3:mb-4 prose-h4:mt-4 [&_h3+h4]:mt-0">
      {children}
    </ArticleLayout>
  )
}
