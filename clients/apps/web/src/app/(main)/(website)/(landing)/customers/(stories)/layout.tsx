import { ArticleLayout } from '@/components/Layout/Public/ArticleLayout'
import ProseWrapper from '@/components/MDX/ProseWrapper'
import { PropsWithChildren } from 'react'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function Layout({ children }: PropsWithChildren) {
  return (
    <ArticleLayout>
      <ProseWrapper>{children}</ProseWrapper>
    </ArticleLayout>
  )
}
