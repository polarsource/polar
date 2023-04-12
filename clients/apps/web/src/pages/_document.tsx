import { Head, Html, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html className="h-full bg-gray-50 antialiased">
      <Head>
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin={'true'}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@350&display=swap"
          rel="stylesheet"
        ></link>
      </Head>
      <body className="h-full">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
