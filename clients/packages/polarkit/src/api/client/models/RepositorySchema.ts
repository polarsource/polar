/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { Visibility } from './Visibility';

export type RepositorySchema = {
  platform: Platforms;
  external_id: number;
  organization_id?: string;
  organization_name: string;
  name: string;
  description?: string;
  open_issues?: number;
  forks?: number;
  stars?: number;
  watchers?: number;
  main_branch?: string;
  topics?: Array<string>;
  license?: string;
  repository_pushed_at?: string;
  repository_created_at?: string;
  repository_modified_at?: string;
  is_private: boolean;
  is_fork?: boolean;
  is_issues_enabled?: boolean;
  is_projects_enabled?: boolean;
  is_wiki_enabled?: boolean;
  is_pages_enabled?: boolean;
  is_downloads_enabled?: boolean;
  is_archived?: boolean;
  is_disabled?: boolean;
  id: string;
  visibility: Visibility;
};

