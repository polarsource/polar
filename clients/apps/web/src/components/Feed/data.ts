import {
  Issue,
  Platforms,
  PolarAPI,
  PolarUserSchemasUser,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { Recommendation } from './Recommendations/Recommendation'

export type Maintainer = {
  username: string
  avatar_url: string
  verified?: boolean
}
export type User = PolarUserSchemasUser
export type PostVisibility = SubscriptionTierType | 'public'

export enum CodeLanguage {
  JavaScript = 'JavaScript',
  TypeScript = 'TypeScript',
  Python = 'Python',
  Java = 'Java',
  C = 'C',
  Cpp = 'C++',
  CSharp = 'C#',
  Go = 'Go',
  Rust = 'Rust',
  Ruby = 'Ruby',
  PHP = 'PHP',
  Scala = 'Scala',
  Kotlin = 'Kotlin',
  Swift = 'Swift',
  Dart = 'Dart',
  Haskell = 'Haskell',
  Lua = 'Lua',
  Perl = 'Perl',
  R = 'R',
  Shell = 'Shell',
  SQL = 'SQL',
  Other = 'Other',
}

export interface Newsletter {
  title: string
  description: string
}

export interface Video {
  title: string
  description: string
  videoUrl: string
  thumbnailUrl: string
}

export interface Audio {
  title: string
  description: string
  audioUrl: string
  thumbnailUrl: string
}

export interface Code {
  language: CodeLanguage
  code: string
}

export interface Poll {
  question: string
  options: {
    text: string
    votes: number
  }[]
  totalVotes: number
}

export interface Post {
  id: string
  title: string
  body: string
  comments: Comment[]
  visibility: PostVisibility
  author: Maintainer
  createdAt: Date
  updatedAt: Date
}

export interface Comment {
  user: User
  text: string
}

export enum RecommendationType {
  Issues = 'Issues',
  Rewards = 'Rewards',
  Jobs = 'Jobs',
  Products = 'Products',
  Event = 'Event',
}

interface BaseRecommendation {
  id: string
  type: RecommendationType
}

export interface IssuesRecommendation extends BaseRecommendation {
  type: RecommendationType.Issues
  issues: Issue[]
}

export interface RewardsRecommendation extends BaseRecommendation {
  type: RecommendationType.Rewards
  issues: Issue[]
}

export type Recommendation = IssuesRecommendation | RewardsRecommendation

export const isRecommendation = (
  entity: Post | Recommendation,
): entity is Recommendation =>
  'type' in entity && entity.type in RecommendationType

export const getFeed = async (
  api: PolarAPI,
): Promise<(Post | Recommendation)[]> => [
  {
    id: '123',

    title: 'What to do when you get stuck on a problem?',
    body: `# We're happy to announce the release of our SDK for JavaScript environments.

It's essentially generated from our OpenAPI schema, and implements a wide array of different capabilities like listing issues looking for funding, embedding Polar badges on GitHub, etc.

Learn more over at the [README](https://polar.sh).

![](https://github.com/newfrgmnt/alma/raw/main/static/cover.png)`,
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
      verified: true,
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '456',
    title: 'How I make code videos',
    body: `A deepdive into my video production process, from recording to editing to publishing. I'll show you how I make my code videos, and how you can make your own!`,
    visibility: 'pro',
    author: {
      username: 'SerenityOS',
      avatar_url: 'https://avatars.githubusercontent.com/u/50811782?v=4',
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '1231231',
    type: RecommendationType.Rewards,
    issues:
      (
        await api.issues.search({
          organizationName: 'emilwidlund',
          platform: Platforms.GITHUB,
        })
      ).items
        // ?.filter((issue) => issue.upfront_split_to_contributors ?? 0 > 0)
        ?.slice(0, 3) ?? [],
  },
  {
    id: '789',
    title: 'This is a post title!',
    body: 'With GitHub actions, you can easily integrate Polar into your workflow. This action will populate your markdown files with avatars of your Polar backers.',
    visibility: 'public',
    author: {
      username: 'polarsource',
      avatar_url: 'https://avatars.githubusercontent.com/u/105373340?v=4',
      verified: true,
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'abc',
    title: 'This is a post title!',
    body: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec.`,
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'def',
    title: 'This is a post title!',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec, mattis tempus felis. Pellentesque ornare posuere velit, quis dictum ante facilisis vitae. Duis venenatis lectus non nunc efficitur tempor. Nulla lorem urna, feugiat efficitur nulla non, tempus commodo elit. ',
    visibility: 'public',
    author: {
      username: 'trpc',
      avatar_url: 'https://avatars.githubusercontent.com/u/78011399?v=4',
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ghi',
    title: 'This is a post title!',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec, mattis tempus felis. Pellentesque ornare posuere velit, quis dictum ante facilisis vitae. Duis venenatis lectus non nunc efficitur.',
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'jkl',

    title: 'What to do when you get stuck on a problem?',
    body: `# We're happy to announce the release of our SDK for JavaScript environments.

It's essentially generated from our OpenAPI schema, and implements a wide array of different capabilities like listing issues looking for funding, embedding Polar badges on GitHub, etc.

Learn more over at the [README](https://polar.sh).`,
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
      verified: true,
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'åäö',
    title: 'How I make code videos',
    body: `A deepdive into my video production process, from recording to editing to publishing. I'll show you how I make my code videos, and how you can make your own!`,
    visibility: 'pro',
    author: {
      username: 'SerenityOS',
      avatar_url: 'https://avatars.githubusercontent.com/u/50811782?v=4',
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'lmn',
    type: RecommendationType.Rewards,
    issues:
      (
        await api.issues.search({
          organizationName: 'emilwidlund',
          platform: Platforms.GITHUB,
        })
      ).items
        // ?.filter((issue) => issue.upfront_split_to_contributors ?? 0 > 0)
        ?.slice(0, 3) ?? [],
  },
  {
    id: 'opq',
    title: 'This is a post title!',
    body: 'With GitHub actions, you can easily integrate Polar into your workflow. This action will populate your markdown files with avatars of your Polar backers.',
    visibility: 'public',
    author: {
      username: 'polarsource',
      avatar_url: 'https://avatars.githubusercontent.com/u/105373340?v=4',
      verified: true,
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rst',
    title: 'This is a post title!',
    body: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec.`,
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'uvw',
    title: 'This is a post title!',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec, mattis tempus felis. Pellentesque ornare posuere velit, quis dictum ante facilisis vitae. Duis venenatis lectus non nunc efficitur tempor. Nulla lorem urna, feugiat efficitur nulla non, tempus commodo elit. ',
    visibility: 'public',
    author: {
      username: 'trpc',
      avatar_url: 'https://avatars.githubusercontent.com/u/78011399?v=4',
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'xyz',
    title: 'This is a post title!',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec, mattis tempus felis. Pellentesque ornare posuere velit, quis dictum ante facilisis vitae. Duis venenatis lectus non nunc efficitur.',
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]
