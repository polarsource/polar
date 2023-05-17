import {
  IssueRead,
  OrganizationPublicRead,
  Platforms,
  RepositoryRead,
  State,
  Visibility,
} from 'polarkit/api/client'

export const org: OrganizationPublicRead = {
  id: 'pydantic',
  platform: Platforms.GITHUB,
  name: 'pydantic',
  avatar_url: 'https://avatars.githubusercontent.com/u/110818415?s=48&v=4',
}

export const issue: IssueRead = {
  platform: Platforms.GITHUB,
  organization_id: 'aa',
  repository_id: 'bb',
  number: 222,
  title: 'SecretStr comparison fails when field is defined with Field',
  reactions: {
    plus_one: 3,
  },
  state: State.OPEN,
  id: 'cc',
  issue_created_at: '2023-04-08',
  external_id: 123,
  created_at: '2023-04-08',
}

export const repo: RepositoryRead = {
  platform: Platforms.GITHUB,
  external_id: 123,
  name: 'pydantic',
  id: 'bb',
  visibility: Visibility.PUBLIC,
  is_private: false,
  license: 'Apache 2.0',
}
