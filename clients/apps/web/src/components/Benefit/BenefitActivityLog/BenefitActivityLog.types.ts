export enum BenefitActivityLogType {
  REVOKED = 'REVOKED',
  GRANTED = 'GRANTED',
  LIFECYCLE = 'LIFECYCLE',
}

export enum ActivityEventContextType {
  ORDER = 'ORDER',
  UPGRADE = 'UPGRADE',
  DOWNGRADE = 'DOWNGRADE',
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  UPDATED = 'UPDATED',
  CREATED = 'CREATED',
  DELETED = 'DELETED',
}

export interface ActivityEventBaseContext {
  type: ActivityEventContextType
}

export interface ActivityEventOrderContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.ORDER
  product: string
}

export interface ActivityEventUpgradeContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.UPGRADE
  fromProduct: string
  toProduct: string
}

export interface ActivityEventDowngradeContext
  extends ActivityEventBaseContext {
  type: ActivityEventContextType.DOWNGRADE
  fromProduct: string
  toProduct: string
}

export interface ActivityEventCreatedContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.CREATED
}

export interface ActivityEventUpdatedContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.UPDATED
}

export interface ActivityEventDeletedContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.DELETED
}

export interface ActivityEventEnabledContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.ENABLED
  product: string
}

export interface ActivityEventDisabledContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.DISABLED
  product: string
}

export type ActivityEventLifecycleContext =
  | ActivityEventEnabledContext
  | ActivityEventDisabledContext
  | ActivityEventCreatedContext
  | ActivityEventUpdatedContext
  | ActivityEventDeletedContext

export interface ActivityEventBase {
  id: string
  user: {
    name: string
    avatar: string
  }
  createdAt: string
  message: string
}

export interface ActivityEventRevoked extends ActivityEventBase {
  type: BenefitActivityLogType.REVOKED
  context:
    | ActivityEventOrderContext
    | ActivityEventUpgradeContext
    | ActivityEventDowngradeContext
}

export interface ActivityEventGranted extends ActivityEventBase {
  type: BenefitActivityLogType.GRANTED
  context:
    | ActivityEventOrderContext
    | ActivityEventUpgradeContext
    | ActivityEventDowngradeContext
}

export interface ActivityEventLifecycle extends ActivityEventBase {
  type: BenefitActivityLogType.LIFECYCLE
  context: ActivityEventLifecycleContext
}

export type ActivityEvent =
  | ActivityEventRevoked
  | ActivityEventGranted
  | ActivityEventLifecycle
