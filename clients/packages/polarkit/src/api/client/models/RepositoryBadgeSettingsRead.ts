/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type RepositoryBadgeSettingsRead = {
  id: string;
  avatar_url?: string;
  name: string;
  synced_issues: number;
  open_issues: number;
  auto_embedded_issues: number;
  label_embedded_issues: number;
  pull_requests: number;
  badge_auto_embed: boolean;
  badge_label: string;
  is_private: boolean;
  is_sync_completed: boolean;
};

