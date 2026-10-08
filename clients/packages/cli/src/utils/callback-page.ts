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

const logo = `<svg width="66" height="66" viewBox="-34 -34 378 378" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M139.50 117.29L57.07 34.86L53.76 37.63L50.91 40.15L48.12 42.74L45.40 45.40L42.74 48.12L40.15 50.91L37.63 53.76L34.72 57.24L117.14 139.66L0.76 139.66L0.42 143.60L0.19 147.39L0.05 151.20L0.00 155.95L0.07 159.75L0.24 163.56L0.49 167.35L0.86 171.29L117.13 171.29L35.14 253.28L37.63 256.24L40.15 259.09L42.74 261.88L46.07 265.27L48.81 267.91L51.62 270.48L54.48 272.99L57.59 275.57L139.50 193.65L139.50 309.22L143.60 309.58L147.39 309.81L151.20 309.95L155.00 310.00L158.80 309.95L162.61 309.81L166.40 309.58L171.14 309.16L171.14 0.84L166.40 0.42L162.61 0.19L158.80 0.05L155.00 0.00L151.20 0.05L147.39 0.19L143.60 0.42L139.50 0.78Z" fill="currentColor"/><path d="M244.21 154.15L244.26 151.50L244.37 148.87L244.53 146.24L244.87 142.33L245.16 139.73L245.69 135.87L246.10 133.31L246.82 129.50L247.36 126.98L247.94 124.47L248.58 121.99L249.62 118.29L250.37 115.85L251.58 112.22L252.44 109.83L253.82 106.28L254.80 103.95L256.34 100.48L257.42 98.20L259.11 94.83L260.30 92.61L262.15 89.33L263.43 87.17L265.43 83.99L266.81 81.91L268.94 78.83L270.42 76.82L272.69 73.86L274.25 71.93L276.66 69.08L279.14 66.32L280.84 64.51L278.35 61.15L275.42 57.41L272.99 54.48L269.85 50.91L267.26 48.12L263.93 44.73L260.49 41.44L257.44 38.67L254.71 41.50L251.53 44.98L248.44 48.55L246.44 50.98L243.52 54.70L241.63 57.23L238.89 61.09L237.12 63.71L234.55 67.71L232.90 70.42L230.52 74.54L229.00 77.34L226.81 81.58L225.42 84.45L223.43 88.81L222.17 91.76L220.38 96.23L219.26 99.24L217.69 103.80L216.71 106.88L215.35 111.54L214.52 114.67L213.39 119.42L212.71 122.61L211.81 127.43L211.28 130.66L210.61 135.55L210.25 138.84L209.82 143.79L209.62 147.11L209.44 152.12L209.41 155.48L209.43 158.39L209.57 162.74L209.82 167.05L210.19 171.32L210.50 174.15L211.05 178.36L211.71 182.53L212.48 186.66L213.05 189.39L213.99 193.45L215.03 197.47L216.18 201.44L217.43 205.37L218.77 209.25L220.21 213.08L221.74 216.87L223.36 220.60L225.07 224.29L226.88 227.92L228.77 231.51L230.74 235.03L232.80 238.51L234.94 241.93L237.16 245.29L239.45 248.59L241.82 251.84L244.27 255.03L246.79 258.15L249.38 261.22L252.04 264.22L254.77 267.16L258.19 270.66L261.19 267.91L264.60 264.60L267.26 261.88L270.48 258.38L272.99 255.52L276.01 251.85L278.93 248.10L281.42 244.68L279.42 242.59L277.25 240.23L275.14 237.81L273.09 235.35L271.09 232.85L269.16 230.30L267.29 227.71L265.48 225.07L263.74 222.39L262.06 219.67L260.45 216.91L258.91 214.11L257.44 211.27L256.04 208.39L254.71 205.47L253.46 202.52L252.27 199.53L251.17 196.51L250.14 193.45L249.19 190.35L248.32 187.23L247.52 184.07L246.81 180.88L246.39 178.74L245.81 175.50L245.33 172.23L244.93 168.93L244.71 166.72L244.45 163.38L244.28 160.01L244.21 156.61Z" fill="currentColor"/></svg>`

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
