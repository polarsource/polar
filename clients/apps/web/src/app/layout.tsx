import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polar',
}

export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin={''}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400&display=swap"
          rel="stylesheet"
        ></link>
        <link href="/favicon.png" rel="icon"></link>
      </head>
      <body className="dark:bg-gray-950 h-full bg-gray-50">{children}</body>
    </html>
  )
}
