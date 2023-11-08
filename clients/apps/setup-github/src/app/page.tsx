'use client'

import { useEffect, useState } from 'react'

export default function Home() {
  const [manifest, setManifest] = useState<string>('')
  const [isGitHubCodespace, setIsGitHubCodespace] = useState(false)

  useEffect(() => {
    let host = window.location.host
    let ingressHost = window.location.host

    if (process.env.NEXT_PUBLIC_CODESPACE_NAME) {
      host = `https://${process.env.NEXT_PUBLIC_CODESPACE_NAME}.${process.env.NEXT_PUBLIC_GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
      ingressHost = `https://${process.env.NEXT_PUBLIC_CODESPACE_NAME}-8080.${process.env.NEXT_PUBLIC_GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
      setIsGitHubCodespace(true)
    } else {
      setIsGitHubCodespace(false)
    }

    const m = JSON.stringify(
      {
        // Redirect URL in the github app manifest setup flow
        // Will not be a part of the app
        redirect_url: `${window.location.protocol}//${window.location.host}/callback`,

        name: `polar-${process.env.NEXT_PUBLIC_CODESPACE_NAME}`.substring(
          0,
          32,
        ),
        url: 'http://localhost',
        hook_attributes: {
          url: `${ingressHost}/api/v1/integrations/github/webhook`,
        },

        setup_url: `${ingressHost}/github/installation?provider=github`,
        setup_on_update: true,
        callback_urls: [`${ingressHost}/github/session`],
        public: true,
        default_permissions: {
          issues: 'write',
          pull_requests: 'write',
          members: 'read',
          organization_events: 'read',
          emails: 'read',
        },
        default_events: [
          'issues',
          'issue_comment',
          'label',
          'pull_request_review',
          'pull_request_review_comment',
          'pull_request_review_thread',
          'public',
          'repository',
          'milestone',
        ],
      },
      null,
      4,
    )
    setManifest(m)
  }, [])

  if (!manifest) {
    return (
      <main className="flex min-h-screen flex-col  gap-12 p-24">Loading..</main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col  gap-12 p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Setup Polar Development
        </p>
      </div>
      <div className="text-gray-800">
        Polar needs a GitHub Application to run. Follow this guide to create one
        in one click!
      </div>
      <div>
        <form
          action="https://github.com/settings/apps/new?state=abc123"
          method="post"
        >
          <input
            type="text"
            name="manifest"
            id="manifest"
            value={manifest}
            className="invisible"
          />
          <br />
          👉👉&nbsp;
          <button
            type="submit"
            className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Create GitHub App
          </button>
          &nbsp;👈👈
        </form>
      </div>
      {isGitHubCodespace ? (
        <div>
          You&apos;re running on GitHub Codespace, this should work out of the
          box!
        </div>
      ) : (
        <div>
          Warning: You&apos;re not running in a tested environment (like GitHub
          Codespace), this might not work.
        </div>
      )}
      <div className="text-xs text-gray-600">
        <h3>Using the following Manifest</h3>
        <pre>
          <code>{manifest}</code>
        </pre>
      </div>
    </main>
  )
}
