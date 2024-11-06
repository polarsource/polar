#!/usr/bin/env node

/* eslint-disable */

// Utility for finding the public URL for a font hosted on Google Fonts. Takes the font
// family name and returns the URL to its .woff file.

// TODO:
//   - Add ability to download the file for self-hosting
//   - Add options for font weights, italic, etc. and character subsets

const fetch = require('node-fetch')

const args = process.argv.slice(2)

const fontFamilyName = args[0]
if (!fontFamilyName) {
  fail('Pass the name of the font family as an argument. It is case-sensitive.')
}

async function run() {
  const response = await fetch(`https://fonts.googleapis.com/css2?family=${fontFamilyName}&display=swap`, {
    "credentials": "omit",
    "headers": {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; Touch; rv:11.0) like Gecko",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "max-age=0"
    },
    "method": "GET",
    //"mode": "cors"
  })
  if (response.ok) {
    const css = await response.text()
    const urls = []
    css.replace(/https?:[^)]*/g, (str) => {
      urls.push(str)
    })
    if (urls.length) {
      console.log(`Use this URL for the font family ${fontFamilyName}:`)
      console.log(urls.join('\n'))
    } else {
      fail('Could not parse font URLs from Google Fonts css file.')
    }
  } else {
    fail(`Could not find font family ${fontFamilyName}. Check its spelling and case and that it exists on Google Fonts.`)
  }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

run()
