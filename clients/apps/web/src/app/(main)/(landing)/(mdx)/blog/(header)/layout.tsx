import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ShadowBoxOnMd className="md:p-16">{children}</ShadowBoxOnMd>
}
