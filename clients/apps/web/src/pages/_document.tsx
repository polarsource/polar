import { Head, Html, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html className="h-full antialiased">
      <Head>
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
      </Head>
      <body className="dark:bg-gray-950 h-full bg-gray-50">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
