export type CallbackOutcome = 'success' | 'denied' | 'invalid'

const copy: Record<CallbackOutcome, { title: string; message: string }> = {
  success: {
    title: 'You are signed in',
    message: 'Return to your terminal to continue. You can close this tab.',
  },
  denied: {
    title: 'Sign-in canceled',
    message:
      'Authorization was denied. Return to your terminal and run <code>void login</code> to try again.',
  },
  invalid: {
    title: 'Something went wrong',
    message:
      'This sign-in link is invalid or has expired. Return to your terminal and run <code>void login</code> again.',
  },
}

export const callbackPage = (outcome: CallbackOutcome) => {
  const { title, message } = copy[outcome]
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Void CLI</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    background: #000; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 32px; max-width: 28rem; }
  h1 { font-size: 20px; font-weight: 500; margin: 0 0 12px; letter-spacing: -0.01em; }
  p { font-size: 15px; line-height: 1.6; margin: 0; color: rgba(255, 255, 255, 0.6); }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px; color: rgba(255, 255, 255, 0.85);
    background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px; padding: 1px 6px; white-space: nowrap;
  }
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>${message}</p>
</main>
</body>
</html>
`
}
