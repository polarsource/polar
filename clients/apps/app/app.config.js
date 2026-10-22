const IS_WIDGET_BUILD = process.env.EXPO_WIDGET_BUILD === '1'

const plugins = [
  'expo-router',
  [
    'expo-splash-screen',
    {
      // oxlint-disable-next-line @polar/no-hardcoded-colors
      backgroundColor: '#000000',
      ios: {
        image: './assets/images/splash.jpg',
        resizeMode: 'cover',
        enableFullScreenImage_legacy: true,
      },
      android: {
        image: './assets/images/splash-android.jpg',
        imageWidth: 288,
      },
    },
  ],
  'expo-secure-store',
  'expo-font',
  'expo-notifications',
  [
    'expo-asset',
    {
      assets: ['./assets/images/splash.jpg'],
    },
  ],
  'expo-web-browser',
]

// Only include Sentry plugin for non-widget builds
// The Sentry plugin fails with @bacons/apple-targets blank template
// because it expects the "Bundle React Native code and images" build phase to exist
if (!IS_WIDGET_BUILD) {
  plugins.push([
    '@sentry/react-native/expo',
    {
      url: 'https://sentry.io/',
      project: 'polar-app',
      organization: 'polar-sh',
    },
  ])
}

plugins.push('@bacons/apple-targets')

module.exports = {
  expo: {
    name: 'Polar',
    slug: 'Polar',
    version: '1.8.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'polar',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    owner: 'polar-sh',
    ios: {
      appleTeamId: '55U3YA3QTA',
      supportsTablet: false,
      bundleIdentifier: 'com.polarsource.Polar',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      icon: './assets/images/ios-dark.png',
      entitlements: {
        'com.apple.developer.applesignin': ['Default'],
        'com.apple.security.application-groups': [
          'group.com.polarsource.Polar',
        ],
        'keychain-access-groups': [
          '$(AppIdentifierPrefix)com.polarsource.Polar',
        ],
      },
      associatedDomains: ['applinks:polar.godetour.link'],
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        // oxlint-disable-next-line @polar/no-hardcoded-colors
        backgroundColor: '#000000',
      },
      package: 'com.polarsource.Polar',
      scheme: 'polar',
      googleServicesFile: './google-services.json',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'polar.godetour.link',
              pathPrefix: '/baSjUTJtg8',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins,
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: false,
        root: './app',
      },
      eas: {
        projectId: '0c79977b-c070-4416-8878-d8b8febe2e25',
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/0c79977b-c070-4416-8878-d8b8febe2e25',
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 20000,
    },
  },
}
