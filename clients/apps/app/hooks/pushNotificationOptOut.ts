import AsyncStorage from '@react-native-async-storage/async-storage'

const PUSH_NOTIFICATIONS_OPTED_OUT_KEY = 'push_notifications_opted_out'

export const getPushNotificationsOptedOut = async () =>
  (await AsyncStorage.getItem(PUSH_NOTIFICATIONS_OPTED_OUT_KEY)) === 'true'

export const setPushNotificationsOptedOut = (optedOut: boolean) =>
  optedOut
    ? AsyncStorage.setItem(PUSH_NOTIFICATIONS_OPTED_OUT_KEY, 'true')
    : AsyncStorage.removeItem(PUSH_NOTIFICATIONS_OPTED_OUT_KEY)
