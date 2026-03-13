import localFont from 'next/font/local'

export const inter = localFont({
  src: [
    { path: './Inter-Light.woff2', weight: '300' },
    { path: './Inter-Regular.woff2', weight: '400' },
    { path: './Inter-Medium.woff2', weight: '500' },
    { path: './Inter-SemiBold.woff2', weight: '600' },
  ],
  display: 'swap',
  variable: '--sans',
})

export const interDisplay = localFont({
  src: [
    { path: './InterDisplay-Light.woff2', weight: '300' },
    { path: './InterDisplay-Regular.woff2', weight: '400' },
    { path: './InterDisplay-Medium.woff2', weight: '500' },
    { path: './InterDisplay-SemiBold.woff2', weight: '600' },
  ],
  display: 'swap',
  variable: '--display',
})

export const louize = localFont({
  src: './Louize-Italic-205TF.otf',
  variable: '--louize',
})
