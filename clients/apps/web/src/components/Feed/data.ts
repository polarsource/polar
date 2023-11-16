import { PolarUserSchemasUser, SubscriptionTierType } from '@polar-sh/sdk'

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

export enum PostType {
  Text = 'Text',
  Video = 'Video',
  Audio = 'Audio',
  Code = 'Code',
  Poll = 'Poll',
  Event = 'Event',
  Job = 'Job',
  Subscription = 'Subscription',
  Product = 'Product',
  Service = 'Service',
}

export interface BasePost {
  slug: string
  text: string
  type: PostType
  media?: string[]
  likes: Like[]
  comments: Comment[]
  visibility: PostVisibility
  author: Maintainer
  createdAt: Date
  updatedAt: Date
}

export interface VideoPost extends BasePost {
  type: PostType.Video
  video: Video
}

export interface AudioPost extends BasePost {
  type: PostType.Audio
  audio: Audio
}

export interface CodePost extends BasePost {
  type: PostType.Code
  code: Code
}

export interface PollPost extends BasePost {
  type: PostType.Poll
  poll: Poll
}

export type Post = BasePost | VideoPost | AudioPost | CodePost | PollPost

export interface Like {
  user: User
}

export interface Comment {
  user: User
  text: string
  likes: Like[]
}

export const posts: Post[] = [
  {
    slug: '123',
    text: `# We're happy to announce the release of our SDK for JavaScript environments.

It's essentially generated from our OpenAPI schema, and implements a wide array of different capabilities like listing issues looking for funding, embedding Polar badges on GitHub, etc.

Learn more over at the [README](https://polar.sh).`,
    type: PostType.Text,
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
      verified: true,
    },
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: '456',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec.',
    type: PostType.Video,
    visibility: 'pro',
    author: {
      username: 'SerenityOS',
      avatar_url: 'https://avatars.githubusercontent.com/u/50811782?v=4',
    },
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    video: {
      title: 'How I make code videos',
      description: `A deepdive into my video production process, from recording to editing to publishing. I'll show you how I make my code videos, and how you can make your own!`,
      videoUrl: 'https://www.youtube.com/watch?v=6vMO3XmNXe4',
      thumbnailUrl:
        'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4D_ngl5BwztyS2CpZ2Dr6o_2iIB4mUXJtJ6GQ7iazkx3QMCl6cNmwp4E8VRf4PNv5skc&usqp=CAU',
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: '789',
    text: 'With GitHub actions, you can easily integrate Polar into your workflow. This action will populate your markdown files with avatars of your Polar backers.',
    type: PostType.Code,
    visibility: 'public',
    author: {
      username: 'polarsource',
      avatar_url: 'https://avatars.githubusercontent.com/u/105373340?v=4',
      verified: true,
    },
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    code: {
      language: CodeLanguage.JavaScript,
      code: `name: 'Polarify'
      description: 'Polar Polarify'
      
      branding:
        icon: dollar-sign
        color: blue
      
      inputs:
        path:
          description: 'Glob pattern of files fo run Polarify on'
          default: "**/*.md"
          required: true
      
      runs:
        using: 'composite'
        steps:
          - name: Install Python
            uses: actions/setup-python@v4
            with:
              python-version: '3.11'
          - name: Run
            run: python \${{ github.action_path }}/polarify.py \${{ inputs.path }}
            shell: bash`,
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: 'abc',
    text: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec.`,
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
    },
    type: PostType.Text,
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: 'def',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec, mattis tempus felis. Pellentesque ornare posuere velit, quis dictum ante facilisis vitae. Duis venenatis lectus non nunc efficitur tempor. Nulla lorem urna, feugiat efficitur nulla non, tempus commodo elit. ',
    type: PostType.Poll,
    visibility: 'public',
    author: {
      username: 'trpc',
      avatar_url: 'https://avatars.githubusercontent.com/u/78011399?v=4',
    },
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    poll: {
      question: 'What is your favorite programming language?',
      options: [
        {
          text: 'JavaScript',
          votes: 10,
        },
        {
          text: 'Python',
          votes: 20,
        },
        {
          text: 'Java',
          votes: 5,
        },
      ],
      totalVotes: 35,
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: 'ghi',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec, mattis tempus felis. Pellentesque ornare posuere velit, quis dictum ante facilisis vitae. Duis venenatis lectus non nunc efficitur.',
    type: PostType.Code,
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
    },
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    code: {
      language: CodeLanguage.JavaScript,
      code: `import React from 'react'`,
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: 'jkl',
    text: `# We're happy to announce the release of our SDK for JavaScript environments.

It's essentially generated from our OpenAPI schema, and implements a wide array of different capabilities like listing issues looking for funding, embedding Polar badges on GitHub, etc.

Learn more over at the [README](https://polar.sh).`,
    type: PostType.Text,
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
      verified: true,
    },
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: 'mno',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec.',
    type: PostType.Video,
    visibility: 'pro',
    author: {
      username: 'SerenityOS',
      avatar_url: 'https://avatars.githubusercontent.com/u/50811782?v=4',
    },
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    video: {
      title: 'How I make code videos',
      description: `A deepdive into my video production process, from recording to editing to publishing. I'll show you how I make my code videos, and how you can make your own!`,
      videoUrl: 'https://www.youtube.com/watch?v=6vMO3XmNXe4',
      thumbnailUrl:
        'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4D_ngl5BwztyS2CpZ2Dr6o_2iIB4mUXJtJ6GQ7iazkx3QMCl6cNmwp4E8VRf4PNv5skc&usqp=CAU',
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: 'pqr',
    text: 'With GitHub actions, you can easily integrate Polar into your workflow. This action will populate your markdown files with avatars of your Polar backers.',
    type: PostType.Code,
    visibility: 'public',
    author: {
      username: 'polarsource',
      avatar_url: 'https://avatars.githubusercontent.com/u/105373340?v=4',
      verified: true,
    },
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    code: {
      language: CodeLanguage.JavaScript,
      code: `name: 'Polarify'
      description: 'Polar Polarify'
      
      branding:
        icon: dollar-sign
        color: blue
      
      inputs:
        path:
          description: 'Glob pattern of files fo run Polarify on'
          default: "**/*.md"
          required: true
      
      runs:
        using: 'composite'
        steps:
          - name: Install Python
            uses: actions/setup-python@v4
            with:
              python-version: '3.11'
          - name: Run
            run: python \${{ github.action_path }}/polarify.py \${{ inputs.path }}
            shell: bash`,
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: 'stu',
    text: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec.`,
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
    },
    type: PostType.Text,
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: 'vwx',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec, mattis tempus felis. Pellentesque ornare posuere velit, quis dictum ante facilisis vitae. Duis venenatis lectus non nunc efficitur tempor. Nulla lorem urna, feugiat efficitur nulla non, tempus commodo elit. ',
    type: PostType.Poll,
    visibility: 'public',
    author: {
      username: 'trpc',
      avatar_url: 'https://avatars.githubusercontent.com/u/78011399?v=4',
    },
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    poll: {
      question: 'What is your favorite programming language?',
      options: [
        {
          text: 'JavaScript',
          votes: 10,
        },
        {
          text: 'Python',
          votes: 20,
        },
        {
          text: 'Java',
          votes: 5,
        },
      ],
      totalVotes: 35,
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    slug: 'yza',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ipsum odio, tincidunt at dictum nec, mattis tempus felis. Pellentesque ornare posuere velit, quis dictum ante facilisis vitae. Duis venenatis lectus non nunc efficitur.',
    type: PostType.Code,
    visibility: 'public',
    author: {
      username: 'emilwidlund',
      avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
    },
    media: [],
    likes: [
      {
        user: {
          username: 'emilwidlund',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
      },
    ],
    code: {
      language: CodeLanguage.JavaScript,
      code: `import React from 'react'`,
    },
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]
