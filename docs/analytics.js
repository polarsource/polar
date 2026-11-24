;(function () {
  var CONSENT_KEY = 'cookie_consent'
  var ANALYTICS_KEY = 'polar_docs_analytics'
  var DISTINCT_ID_COOKIE = 'polar_distinct_id'
  var POSTHOG_PERSISTENCE_KEY =
    'ph_phc_H2ajVAY4cy0uQpcgN5fzpv8JC3yP8VZOjx2EXiFBbgz_posthog'
  var ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key)
    } catch (e) {
      return null
    }
  }

  function storageSet(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, value)
    } catch (e) {}
  }

  function readCookie(name) {
    var prefix = name + '='
    var row = document.cookie.split('; ').find(function (entry) {
      return entry.indexOf(prefix) === 0
    })
    return row ? decodeURIComponent(row.slice(prefix.length)) : null
  }

  function deleteCookie(name) {
    var expired = name + '=; max-age=0; path=/'
    document.cookie = expired
    document.cookie = expired + '; domain=.' + window.location.hostname
  }

  function isLikelyEuropean() {
    try {
      var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!timezone) return true
      if (timezone.indexOf('Europe/') === 0) return true
      return [
        'Atlantic/Azores',
        'Atlantic/Canary',
        'Atlantic/Faroe',
        'Atlantic/Madeira',
        'Atlantic/Reykjavik',
        'Arctic/Longyearbyen',
        'Asia/Famagusta',
        'Asia/Nicosia',
        'America/Danmarkshavn',
        'America/Nuuk',
        'America/Scoresbysund',
        'America/Thule',
      ].indexOf(timezone) !== -1
    } catch (e) {
      return true
    }
  }

  function consent() {
    return storageGet(CONSENT_KEY) || 'undecided'
  }

  function analyticsAllowed() {
    var current = consent()
    return current === 'yes' || (!isEuropean && current !== 'no')
  }

  function parseDistinctId(raw) {
    if (!raw) return null
    try {
      var id = JSON.parse(raw).distinct_id
      return typeof id === 'string' ? id : null
    } catch (e) {
      return null
    }
  }

  function syncDistinctId() {
    if (readCookie(DISTINCT_ID_COOKIE)) return true
    var distinctId =
      parseDistinctId(readCookie(POSTHOG_PERSISTENCE_KEY)) ||
      parseDistinctId(storageGet(POSTHOG_PERSISTENCE_KEY))
    if (!distinctId || !/^[\w-]+$/.test(distinctId)) return false
    document.cookie =
      DISTINCT_ID_COOKIE +
      '=' +
      distinctId +
      '; max-age=' +
      ONE_YEAR_SECONDS +
      '; path=/; samesite=lax' +
      (window.location.protocol === 'https:' ? '; secure' : '')
    return true
  }

  function startDistinctIdSync() {
    var attempts = 0
    var timer = window.setInterval(function () {
      attempts += 1
      if (syncDistinctId() || attempts >= 20) window.clearInterval(timer)
    }, 500)
    window.addEventListener('mintlify:navigate', syncDistinctId)
  }

  function clearPostHogStorage() {
    storageSet(POSTHOG_PERSISTENCE_KEY, null)
    deleteCookie(POSTHOG_PERSISTENCE_KEY)
  }

  function applyConsent() {
    var allowed = analyticsAllowed()
    storageSet(ANALYTICS_KEY, allowed ? 'yes' : null)
    if (allowed === loadedWithAnalytics) return
    if (!allowed) {
      clearPostHogStorage()
      window.location.reload()
    }
  }

  function setConsent(value) {
    storageSet(CONSENT_KEY, value)
    applyConsent()
  }

  function element(tag, className, text) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (text) node.textContent = text
    return node
  }

  function button(className, text, onClick) {
    var node = element('button', className, text)
    node.type = 'button'
    node.addEventListener('click', onClick)
    return node
  }

  function showBanner() {
    var banner = element('div', 'polar-cookie-banner')
    banner.appendChild(
      element(
        'p',
        null,
        'We use tracking cookies to understand how you use the product and help us improve it.',
      ),
    )
    var actions = element('div', 'polar-cookie-banner__actions')
    actions.appendChild(
      button('polar-cookie-banner__accept', 'Accept', function () {
        banner.remove()
        setConsent('yes')
      }),
    )
    actions.appendChild(
      button('polar-cookie-banner__decline', 'Decline', function () {
        banner.remove()
        setConsent('no')
      }),
    )
    banner.appendChild(actions)
    document.body.appendChild(banner)
  }

  var isEuropean = isLikelyEuropean()
  var loadedWithAnalytics = storageGet(ANALYTICS_KEY) === 'yes'
  var doNotTrack = new URLSearchParams(window.location.search).has(
    'do_not_track',
  )

  if (doNotTrack && consent() === 'undecided') storageSet(CONSENT_KEY, 'no')

  applyConsent()

  if (loadedWithAnalytics) {
    startDistinctIdSync()
  } else {
    window.addEventListener('mintlify:navigate', function () {
      if (storageGet(ANALYTICS_KEY) === 'yes') window.location.reload()
    })
  }

  if (isEuropean && !doNotTrack && consent() === 'undecided') showBanner()
})()
