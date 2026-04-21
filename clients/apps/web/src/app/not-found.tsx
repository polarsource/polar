import '../styles/globals.css'

import PageNotFound from '@/components/Shared/PageNotFound'

export default function NotFound() {
  return (
    <html lang="en" className="antialiased">
      <body style={{ textRendering: 'optimizeLegibility' }}>
        <PageNotFound />
      </body>
    </html>
  )
}
