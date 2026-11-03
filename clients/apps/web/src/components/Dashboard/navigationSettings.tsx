import {
  SETTINGS_SECTIONS,
  SettingsSection,
  SettingsSectionSlug,
} from '@/components/Settings/settingsSections'
import { schemas } from '@polar-sh/client'
import {
  CircleUserRound,
  CodeXml,
  CreditCard,
  Download,
  Flag,
  FlaskConical,
  Globe,
  Key,
  LogIn,
  Lock,
  Mail,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  TextCursorInput,
  User,
  Users,
  Wallet,
  Bell,
} from '@polar-sh/orbit/icons'
import { useMemo } from 'react'
import { Route, RouteWithActive, useResolveRoutes } from './navigation'

export type SettingsRouteGroup = {
  readonly title: string
  readonly routes: RouteWithActive[]
}

type SettingsGroupDefinition = {
  readonly title: string
  readonly routes: Route[]
}

const settingsGroupsList = (
  org: schemas['Organization'] | undefined,
): SettingsGroupDefinition[] => {
  const base = `/dashboard/${org?.slug}/settings`
  const section = (
    slug: SettingsSectionSlug,
    icon: React.ReactElement,
  ): Route => {
    const definition: SettingsSection = SETTINGS_SECTIONS[slug]
    return {
      id: `settings-${slug}`,
      title: definition.title,
      link: `${base}/${slug}`,
      icon,
      if: !org || !definition.isAvailable || definition.isAvailable(org),
    }
  }

  return [
    {
      title: 'Organization',
      routes: [
        {
          id: 'settings-general',
          title: 'General',
          link: base,
          icon: <Settings2 size="1em" />,
          if: true,
          checkIsActive: (path) => path === base,
        },
        {
          id: 'settings-members',
          title: 'Members',
          link: `${base}/members`,
          icon: <Users size="1em" />,
          if: true,
        },
        section('notifications', <Bell size="1em" />),
        {
          id: 'settings-billing',
          title: 'Billing',
          link: `${base}/billing`,
          icon: <CreditCard size="1em" />,
          if: true,
        },
        {
          id: 'settings-sso',
          title: 'Single Sign-On',
          link: `${base}/sso`,
          icon: <LogIn size="1em" />,
          if: !!org?.feature_settings?.sso_enabled,
        },
        section('domains', <Globe size="1em" />),
        section('features', <FlaskConical size="1em" />),
      ],
    },
    {
      title: 'Payments',
      routes: [
        section('payments', <Wallet size="1em" />),
        section('subscriptions', <RefreshCw size="1em" />),
        section('disputes', <Flag size="1em" />),
        section('customer-portal', <CircleUserRound size="1em" />),
        section('customer-notifications', <Mail size="1em" />),
        {
          id: 'settings-custom-fields',
          title: 'Custom Fields',
          link: `${base}/custom-fields`,
          icon: <TextCursorInput size="1em" />,
          if: true,
        },
      ],
    },
    {
      title: 'Developers',
      routes: [
        section('access-tokens', <Key size="1em" />),
        {
          id: 'settings-webhooks',
          title: 'Webhooks',
          link: `${base}/webhooks`,
          icon: <Send size="1em" />,
          if: true,
        },
        section('embedding', <ShieldCheck size="1em" />),
        {
          id: 'settings-migrations',
          title: 'Migrations',
          link: `${base}/migrations`,
          icon: <Download size="1em" />,
          if: true,
        },
      ],
    },
    {
      title: 'Account',
      routes: [
        section('profile', <User size="1em" />),
        section('security', <Lock size="1em" />),
        section('developer', <CodeXml size="1em" />),
      ],
    },
  ]
}

const settingsRoutesList = (org?: schemas['Organization']): Route[] =>
  settingsGroupsList(org).flatMap((group) => group.routes)

export const useSettingsRoutes = (
  org?: schemas['Organization'],
): RouteWithActive[] => useResolveRoutes(settingsRoutesList, org)

export const useSettingsRouteGroups = (
  org?: schemas['Organization'],
): SettingsRouteGroup[] => {
  const routes = useSettingsRoutes(org)

  return useMemo(() => {
    const routesById = new Map(routes.map((route) => [route.id, route]))
    return settingsGroupsList(org)
      .map((group) => ({
        title: group.title,
        routes: group.routes.flatMap((route) => {
          const resolved = routesById.get(route.id)
          return resolved ? [resolved] : []
        }),
      }))
      .filter((group) => group.routes.length > 0)
  }, [org, routes])
}
