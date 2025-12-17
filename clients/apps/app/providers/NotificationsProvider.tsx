import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Linking from 'expo-linking'
import * as Notifications from 'expo-notifications'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useSession } from './SessionProvider'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function handleRegistrationError(errorMessage: string) {
  // alert(errorMessage);
  throw new Error(errorMessage)
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    // Don't throw error, just return - badge clearing still works without push token
    return
  }

  // Only try to get push token on real devices
  if (!Device.isDevice) {
    return
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId
  if (!projectId) {
    handleRegistrationError('Project ID not found')
  }
  try {
    const pushTokenString = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data
    return pushTokenString
  } catch (e: unknown) {
    handleRegistrationError(`${e}`)
  }
}

const NotificationsContext = createContext<{
  expoPushToken: string
  notification: Notifications.Notification | undefined
}>({
  expoPushToken: '',
  notification: undefined,
})

export const useNotifications = () => useContext(NotificationsContext)

export default function NotificationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [expoPushToken, setExpoPushToken] = useState('')
  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >(undefined)
  const notificationListener = useRef<Notifications.EventSubscription>(null)
  const responseListener = useRef<Notifications.EventSubscription>(null)

  const { session } = useSession()

  useEffect(() => {
    if (!session) {
      return
    }

    registerForPushNotificationsAsync().then((token) =>
      setExpoPushToken(token ?? ''),
    )

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        setNotification(notification)
      })

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data
        if (data?.deepLink && typeof data.deepLink === 'string') {
          Linking.openURL(data.deepLink)
        }
      })

    return () => {
      notificationListener.current && notificationListener.current.remove()
      responseListener.current && responseListener.current.remove()
    }
  }, [session])

  return (
    <NotificationsContext.Provider value={{ expoPushToken, notification }}>
      {children}
    </NotificationsContext.Provider>
  )
}
