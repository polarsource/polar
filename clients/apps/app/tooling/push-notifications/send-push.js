const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
// eslint-disable-next-line no-undef
const TEMP_FILE = path.join(__dirname, '.push-payload-temp.json')
const payloads = require('./push-payload')
const BUNDLE_ID = 'com.polarsource.Polar'

// Update this with one of the push notification names in push-payload.js
const SELECTED_PUSH_NOTIFICATION = 'newOrder'

const payload = payloads[SELECTED_PUSH_NOTIFICATION]
if (!payload) {
  console.error(`Unknown payload: "${SELECTED_PUSH_NOTIFICATION}"`)
  console.error(`Available: ${Object.keys(payloads).join(', ')}`)
  process.exit(1)
}

try {
  fs.writeFileSync(TEMP_FILE, JSON.stringify(payload, null, 2))

  console.log(
    `Sending "${SELECTED_PUSH_NOTIFICATION}" push notification to iOS simulator...`,
  )
  execSync(`xcrun simctl push booted "${BUNDLE_ID}" "${TEMP_FILE}"`, {
    stdio: 'inherit',
  })
} catch (error) {
  console.error(`Failed: ${error.message}`)
  process.exit(1)
} finally {
  if (fs.existsSync(TEMP_FILE)) {
    fs.unlinkSync(TEMP_FILE)
  }
}
