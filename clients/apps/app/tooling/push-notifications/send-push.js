const { execSync } = require('child_process')
const path = require('path')

// eslint-disable-next-line no-undef
const PAYLOAD_FILE = path.join(__dirname, 'push-payload.json')
const BUNDLE_ID = 'com.polarsource.Polar'

try {
  execSync(`xcrun simctl push booted "${BUNDLE_ID}" "${PAYLOAD_FILE}"`, {
    stdio: 'inherit',
  })
} catch (error) {
  console.error(`Failed to send push notification: ${error.message}`)
  process.exit(1)
}
