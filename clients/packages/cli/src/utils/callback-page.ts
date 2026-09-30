export type CallbackOutcome = 'success' | 'denied' | 'invalid'

const copy: Record<
  CallbackOutcome,
  { title: string; message: string; note?: string }
> = {
  success: {
    title: 'You are signed in',
    message: 'Return to your terminal to continue.',
    note: 'You can close this tab.',
  },
  denied: {
    title: 'Sign-in canceled',
    message:
      'Authorization was denied. Return to your terminal and run <code>polar auth login</code> to try again.',
  },
  invalid: {
    title: 'Something went wrong',
    message:
      'This sign-in link is invalid or has expired. Return to your terminal and run <code>polar auth login</code> again.',
  },
}

export const autoCloseScript = `(() => {
  if (history.length > 1) return
  const note = document.getElementById("note")
  const fallback = note.textContent
  let seconds = 5
  const tick = () => {
    if (seconds === 0) {
      window.close()
      setTimeout(() => {
        note.textContent = fallback
      }, 300)
      return
    }
    note.innerHTML =
      "Closing this tab in <span class='seconds'>" + seconds + "</span>\u2026"
    seconds -= 1
    setTimeout(tick, 1000)
  }
  tick()
})()`

const autoClose = `<script>
${autoCloseScript}
</script>`

const logo = `<svg width="88" height="88" viewBox="-59 -59 428 428" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M139.5 193.65L61.48 271.67L39.11 249.31L117.13 171.29H0.85C0.29 165.94 0 160.5 0 155C0 149.82 0.25 144.71 0.75 139.66H117.13L34.71 57.24C41.38 49.04 48.88 41.54 57.06 34.85L139.5 117.29V0.77C144.6 0.26 149.77 0 155 0C160.45 0 165.83 0.28 171.14 0.83V309.17C165.83 309.72 160.45 310 155 310C149.77 310 144.6 309.74 139.5 309.23ZM209.41 155.48C209.41 110.36 227.85 68.62 257.44 38.67C266.17 46.37 274.03 55.03 280.85 64.5C258.28 88.02 244.2 120.49 244.2 155.48C244.2 190.28 258.52 221.27 281.43 244.69C274.67 254.2 266.87 262.91 258.19 270.66C228.64 241.24 209.41 201.13 209.41 155.48Z" fill="currentColor"/>
</svg>`

export const callbackPage = (outcome: CallbackOutcome) => {
  const { title, message, note } = copy[outcome]
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Polar CLI</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    background: #000; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 32px; max-width: 28rem; }
  svg {
    display: block; margin-bottom: 32px;
    animation: appear 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes appear {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) { svg { animation: none; } }
  h1 { font-size: 20px; font-weight: 500; margin: 0 0 12px; letter-spacing: -0.01em; }
  p { font-size: 15px; line-height: 1.6; margin: 0; color: rgba(255, 255, 255, 0.6); }
  .seconds { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 14px; }
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
${logo}
<h1>${title}</h1>
<p>${message}${note ? ` <span id="note">${note}</span>` : ''}</p>
</main>
${outcome === 'success' ? autoClose : ''}
</body>
</html>
`
}
