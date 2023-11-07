'use client'

export default function Home() {
  const manifest = JSON.stringify(
    {
      // Redirect URL in the github app manifest setup flow
      // Will not be a part of the app
      redirect_url: `http://${window.location.host}/callback`,

      name: 'My-Polar-Dev',
      url: 'http://localhost',
      hook_attributes: {
        url: 'https://polarzegl.eu.ngrok.io/api/v1/integrations/github/webhook',
      },

      setup_url:
        'https://polarzegl.eu.ngrok.io/github/installation?provider=github',
      setup_on_update: true,
      callback_urls: ['https://polarzegl.eu.ngrok.io/github/session'],
      public: true,
      default_permissions: {
        issues: 'write',
        pull_requests: 'write',
        members: 'read',
        organization_events: 'read',
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

  // https://polarzegl.eu.ngrok.io/github/installation?code=8c630b4cef5467ea7bfa180332f175e09131cbf2&provider=github&state=abc123

  // const createGitHubApp = () => {
  //   input = document.getElementById('manifest')
  //   input.value = JSON.stringify({
  //     name: 'Octoapp',
  //     url: 'https://www.example.com',
  //     hook_attributes: {
  //       url: 'https://example.com/github/events',
  //     },
  //     redirect_url: 'https://example.com/redirect',
  //     callback_urls: ['https://example.com/callback'],
  //     public: true,
  //     default_permissions: {
  //       issues: 'write',
  //       checks: 'write',
  //     },
  //     default_events: ['issues', 'issue_comment', 'check_suite', 'check_run'],
  //   })
  // }

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
      <div className="text-gray-600">
        <h3>Using the following Manifest</h3>
        <pre>
          <code>{manifest}</code>
        </pre>
      </div>
    </main>
  )
}
