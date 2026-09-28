import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/Users/ewidlund/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:3000/company', { waitUntil: 'networkidle', timeout: 90000 })
console.log((await page.evaluate(() => [...document.querySelectorAll('h6')].map((h) => h.textContent.trim().slice(0, 40)))).join(' | '))
await browser.close()
