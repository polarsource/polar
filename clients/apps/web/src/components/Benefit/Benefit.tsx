import {
  FileDownloadOutlined,
  HeadsetMicOutlined,
  KeyOutlined,
  MovieOutlined,
  ShortTextOutlined,
} from '@mui/icons-material'
import {
  SubscriptionBenefitCustom,
  SubscriptionBenefitType,
  SubscriptionTierBenefit,
} from '@polar-sh/sdk'

export enum BenefitType {
  DISCORD = 'Discord',
  LICENSE = 'License',
  DIGITAL_DOWNLOAD = 'Digital Download',
  TUTORIAL = 'Tutorial',
}

export interface DiscordBenefit
  extends Omit<SubscriptionBenefitCustom, 'type'> {
  type: BenefitType.DISCORD
  channels: {
    id: string
    name: string
    permissions: string[]
  }[]
}

export interface FileBenefit extends Omit<SubscriptionBenefitCustom, 'type'> {
  type: BenefitType.DIGITAL_DOWNLOAD
  files: {
    name: string
    url: string
    size: number
  }[]
}

export interface TutorialBenefit
  extends Omit<SubscriptionBenefitCustom, 'type'> {
  type: BenefitType.TUTORIAL
  videos: {
    name: string
    url: string
    duration: number
  }[]
}

export interface LicenseBenefit
  extends Omit<SubscriptionBenefitCustom, 'type'> {
  type: BenefitType.LICENSE
  license: {
    key: string
  }
}

export type Benefit =
  | SubscriptionTierBenefit
  | DiscordBenefit
  | LicenseBenefit
  | TutorialBenefit
  | FileBenefit

export const resolveBenefitTypeIcon = (
  type: BenefitType | SubscriptionBenefitType,
) => {
  switch (type) {
    case BenefitType.DISCORD:
      return HeadsetMicOutlined
    case BenefitType.LICENSE:
      return KeyOutlined
    case BenefitType.DIGITAL_DOWNLOAD:
      return FileDownloadOutlined
    case BenefitType.TUTORIAL:
      return MovieOutlined
    case 'articles':
      return ShortTextOutlined
    default:
      return () => null
  }
}
