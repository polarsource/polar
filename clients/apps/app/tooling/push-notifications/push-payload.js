const BUNDLE_ID = 'com.polarsource.Polar'

const payloads = {
  newOrder: {
    'Simulator Target Bundle': BUNDLE_ID,
    aps: {
      alert: {
        title: 'New Order',
        body: 'You received a new order for $49.00',
      },
      sound: 'default',
      badge: 1,
    },
    body: {
      // Update with a proper order ID
      deepLink: 'polar://orders/517a341f-6df1-4d21-8c32-c236a7d4069d',
    },
  },

  productsList: {
    'Simulator Target Bundle': BUNDLE_ID,
    aps: {
      alert: {
        title: 'Check Your Products',
        body: 'You have 5 products available',
      },
      sound: 'default',
    },
    body: {
      deepLink: 'polar://products',
    },
  },

  simpleAlert: {
    'Simulator Target Bundle': BUNDLE_ID,
    aps: {
      alert: {
        title: 'Hello!',
        body: 'This is a test notification that does not open a deep link',
      },
      sound: 'default',
    },
  },
}

module.exports = payloads
