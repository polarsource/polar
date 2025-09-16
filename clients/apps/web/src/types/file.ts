import { schemas } from '@polar-sh/client'

export type FileRead =
  | schemas['DownloadableFileRead']
  | schemas['ProductMediaFileRead']
  | schemas['OrganizationAvatarFileRead']
  | schemas['OAuth2ClientLogoFileRead']