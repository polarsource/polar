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
    body: `Suo educta factas insuperabile circum ferarum alti. Consequitur feres tenuisse littera retentis cognita potest

Lorem markdownum cuncta, per terra totoque; et et pariter revocare quos. Aera
boves corpora: parentis adulantum paventem circum vestras. Dies sed regna tibi,
tinxerat contendere lugebere quoque mensis inposita linguaque divus: me nuda
eadem, auras novi.

- Manibus repulsae
- Tellure enim
- Levibus pugnandi id incinxit uteri licet
- Dictis et cum his neu edidit de

\`\`\`javascript
export default async function Page({
  params,
}: {
  params: { organization: string; postId: string }
}) {
  const api = getServerSideAPI()
  const posts = await getFeed(api)

  const post = posts.find((post) => 'id' in post && post.id === params.postId)

  return (
    <div className="relative my-16 flex flex-row items-start rounded-3xl bg-white p-12 shadow-lg">
      <Link className="absolute left-16 top-16 flex-shrink" href="/posts">
        <Button
          size="sm"
          variant="secondary"
          className="group flex h-8 w-8 flex-col items-center justify-center rounded-full border"
        >
          <ArrowBackOutlined fontSize="inherit" />
        </Button>
      </Link>
      <div className="flex w-full flex-grow flex-col items-center gap-y-8 pb-12">
        <LongformPost post={post as Post} />
      </div>
    </div>
  )
}
\`\`\`

## Ego ultra siquem et aditum sequuntur

Satis Graecia pro unguibus pallor natis suis edendo, inter non, genetivaque
vitae ipsisque Phiale! Manusque capillos in tantum hi prior tergoque finiat
faciente essent, quod alto cognorat in regat. Alumno quid habet si **Hyaleque**
clamore pugman in **dotabere temperie** gratia. Vela **residens**, Spercheides
simus, quae missum!

## Ille orat novissima patulos iacit reliquit

Volanti nobis, nunc nati effuge telas noscit ipse operi. Partim pignus inmensum
rupe, parientem naiadum corpus fuit ignibus thalamis dum. Elimat prope: frontem
vino scilicet spatiis creaverat plangore nocte; quae.

## Tu titulum potestis fletumque esse praecordia

Voveam Isi et deceperit Phinea proelia an spem vitiaverit in Canache patent qui
agebat locat adhuc Desine Lyaeo Saturnius lapidumque. Illam Solem haud clamore,
[titulum tenuit](http://www.tu-sensit.org/)! Lancea sunt, qui Iunonem quaesitis
amissa seque: esto ita. Tergo pleno titubantem imagine fecit nobis: curru
umbrae, trabes.

## Turpe ne socios

[Mecum iubis](http://pia-non.net/) semiferos pars est sagittis satis. Hastam
iacuit; a auctor minor, nam adsumus primus ora. Nec cum enodisque numen soceri
sensisse Iphi, et huius, laedor, gentes modo haerentes.

- Cuspide Assyrius vellent incessus vultus tendere montibus
- Secutus impediebat colonos clausit inquit virgo favorem
- Herculeo servitque eadem nam caeleste tellus

Passis hic convertor herba circumtulit [silvis vix
deus](http://detvincitur.net/) veni domitis foret, quae. Portasse obortis
fertur. **Pestifero tamen** Amnis, adita loqui oppositumque decent inquit
quaeque in *umentes quoque*. Coeunt concipit, artus populis subitis dea apta
meum Cyclopum lege qui Iani conplexus cruore duplici votoque in cunctis. Illos
latuerunt Thestius?

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
    title: 'New funding page, method & a better backer experience',
    body: `Excited to share another changelog post today of the efforts we’ve shipped over the last two weeks. Focusing on removing friction for backers to fund even more towards your impactful open source efforts. Let’s dig into it.

### New funding page

![](https://blog.polar.sh/content/images/2023/09/Frame-860--1-.jpg)

We redesigned the funding page from the ground up and think it’s a pretty fantastic update. Supporting all the features mentioned below (and some easter eggs to come soon). [Check it out](https://polar.sh/polarsource/polar/issues/897?ref=blog.polar.sh).

### **Fund on completion**

![](https://blog.polar.sh/content/images/2023/09/Frame-862.jpg)

Up until now, there has only been one way to fund open source issues with Polar: Upfront. Backers had to pay directly when they wanted to help fund a specific effort. Polar would then hold those funds until you - the maintainer - marked the issue as completed before paying it out (pending a review period for the backers).

That’s great, but not always... As a maintainer, you might want it to reach a certain funding goal before backers part with their money. You also want it to be accessible to all potential backers and some of them are less comfortable paying upfront.

So we’re introducing pledges. Now, backers can choose to fund an issue upon completion. Meaning they make a pledge upfront, but payment first once it’s due via invoicing - after the issue has been marked completed.

![](https://blog.polar.sh/content/images/2023/09/Frame-858--1-.jpg)

Backers will be required to have a connected GitHub account to use this funding method. So you can see who has made a pledge within your dashboard (spoiler alert - see below). Email-only (guest) funding is still available, but only with the upfront funding method.

### Social funding

![](https://blog.polar.sh/content/images/2023/09/Frame-859.jpg)

We’ve updated the design of our dashboard and badge to highlight the awesome backers who are supporting your open source efforts. Some well-deserved recognition for them and some helpful insights to you.

### Magic link sign-in for backers

![](https://blog.polar.sh/content/images/2023/09/Frame-861.jpg)

In our [last changelog](https://blog.polar.sh/funding-goals-reward-contributors-v1-backer-dashboard-api/), we announced a dedicated dashboard for backers to keep track of their funded issues, get personal recommendations on additional ones to fund and more. However, it required them to have signed up with a GitHub account.

Not anymore. Backers can now sign in using magic links. Supporting a better experience and upgrade path to all of your backers.

### Credit card on file

Backers can now seamlessly & securely save their payment method details on file (via Stripe). Offering one-click funding in the future. Combined with quick payment of invoices for their pledges once they’re due.

* * *

Together, we believe these features remove a lot of friction for backers which in turn opens the door for more funding toward your awesome initiatives which is our mission here at Polar.

Finally, this week we planned the [roadmap](https://github.com/polarsource/polar/issues?q=is%3Aopen+is%3Aissue+label%3Aepics&ref=blog.polar.sh) ahead for our next quarter based on our [North Star](https://github.com/polarsource/polar/issues/897?ref=blog.polar.sh), and we can’t wait to ship everything we have in store.

Until next time,

/ Polar Team`,
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
    body: `### We're happy to announce the release of our SDK for JavaScript environments.

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
