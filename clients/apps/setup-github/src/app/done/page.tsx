'use client'

import { useEffect, useState } from 'react'

export default function Page() {
  const [link, setLink] = useState('')

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_CODESPACE_NAME) {
      setLink(
        `https://${process.env.NEXT_PUBLIC_CODESPACE_NAME}-8080.${process.env.NEXT_PUBLIC_GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}/login`,
      )
    } else {
      setLink('')
    }
  })

  return (
    <main className="flex min-h-screen flex-col  gap-12 p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Setup Polar Development
        </p>
      </div>
      <div className="text-gray-800">
        BOOM! You&apos;re done! Updated .env files have been written to disk.
        <br />
        Restart the `./bin/start` script to reload your configuration.
      </div>
      <div className="text-gray-800">
        👉👉&nbsp;
        <a
          href={link}
          type="submit"
          className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Go To Polar App
        </a>
        &nbsp;👈👈
      </div>

      <pre className="text-xs text-gray-800">{link}</pre>
    </main>
  )
}
