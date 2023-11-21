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
  demoEmbedIssuesOrganizationName: string,
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
    title: 'Introducing Rewards',
    body: `Today, we're incredibly excited to announce contributor rewards with Polar.

You can think of it as bounties, but don't worry – it's designed for maintainers and your communities for a change.

How?

### Empowering maintainers vs. steamrolling them

Your scarcest resources as an open source maintainer is time & capital. Bounties have historically been a tax on both.

Well-intended backers post bounties to public marketplaces. Triggering contributors to chase the prize before you're even aware, onboard and aligned with the effort. Sometimes stars align, but often not – wasting time, energy and capital for everyone involved.

In order to gain control (ish) you might create an official profile - only to then be expected to cover the bounties yourself out of pocket...

It's a broken game. So understandably most maintainers choose not to play. Yet, many backers want to help fund specific efforts – it's a shame to squander it.

With Polar, maintainers are in full control. You can easily add & promote seamless funding towards specific issues with the Polar badge. On all of them automatically or manually labelled ones.

![](https://blog.polar.sh/content/images/2023/10/Frame-863.jpg)

Backers now see this option promoted directly on issues they care about and want to support. Just in a few clicks, they can fund it upfront or pledge to pay an invoice on completion.

They can also make a pledge to non-badged issues, but it's then in private first so you retain control.

You can see & manage it all beautifully in our dashboard.

![](https://blog.polar.sh/content/images/2023/10/Frame-866.jpg)

That's all fantastic, but what if contributors help close this issue? You can now reward them a percentage of the funding. Do you want to promote it in advance? You can setup a public & upfront split.

![](https://blog.polar.sh/content/images/2023/10/Frame-865-1.jpg)

![](https://blog.polar.sh/content/images/2023/10/Frame-864-1.jpg)

![](https://blog.polar.sh/content/images/2023/10/Frame-868-1.jpg)

Once an issue is closed and you mark it as completed within Polar, you can quickly distribute the rewards between yourself and contributors 🎉 You can do this even if the reward is not public upfront.

![](https://blog.polar.sh/content/images/2023/10/Frame-711.jpg)

By default, we suggest a 50/50 split between you as a maintainer and contributors. After all, don't forget to reward yourself too for feedback, review and ongoing maintenance 🤓 Or give it all to contributors – you're in control (a core principle of ours).

We do also offer maintainers the ability to "Boost" the reward by making a pledge themselves towards the funding pool (to be paid on completion). Enabling maintainers with funding already from elsewhere to seed the initial reward if they want to. However, it's not required nor expected, but a great utility in the toolbox.

Rewarding community vs. attracting drive-by contributions
---------------------------------------------------------

Finally, we've designed Polar and rewards too to be beautifully integrated with GitHub. Combined with your dedicated Polar page for sharing with your audience wherever they are (Discord, Mastodon, Twitter etc).

Favouring sharing & giving rewards to genuine members of your community vs. creating a public directory for bounty hunters.

We believe maintainers receiving or having funding for rewards, already have a community of contributors. Or an audience to promote it too directly. Naturally creating a better filter for the proper incentives.

We could definitely be wrong. In case attracting new contributors is a common feature request from maintainers, we'll certainly explore it for the future and design it with these principles in mind.

Until then, we'll continue focusing on building a platform for better funding for maintainers to help reward you and your communities. You can read more about our long-term vision [here](https://blog.polar.sh/polar-v1-0-lets-fix-open-source-funding/).

* * *

We hope you share our excitement for rewards with Polar. We can't wait to see how you use it within your communities & hear what you think!

Don't hesitate to [join our Discord](https://discord.gg/XKVxpXQbWV?ref=blog.polar.sh) if you have any questions or feedback. Or submit discussions and issues to our [GitHub](https://github.com/polarsource/polar?ref=blog.polar.sh) (Polar is open source). We iterate quickly based on feedback.

Our best,  
The Polar maintainers`,
    visibility: 'pro',
    author: {
      username: 'polarsource',
      avatar_url: 'https://avatars.githubusercontent.com/u/105373340?v=4',
      verified: true,
    },
    comments: [],
    createdAt: new Date('October 10, 2023'),
    updatedAt: new Date('October 10, 2023'),
  },
  {
    id: '1231231',
    type: RecommendationType.Rewards,
    issues:
      (
        await api.issues.search({
          organizationName: demoEmbedIssuesOrganizationName,
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
    createdAt: new Date('September 29, 2023'),
    updatedAt: new Date('September 29, 2023'),
  },
  {
    id: 'abc',
    title: 'Funding goals, reward contributors (v1), backer dashboard & API',
    body: `Our team is growing and new features, enhancements and bug fixes are shipped daily. Since Polar is [open source](https://github.com/polarsource/polar?ref=blog.polar.sh) anyone can see, contribute and follow along our daily progress & backlog, but... It's a bit verbose :-)

So we'll start keeping a changelog to highlight some of the gems. Let's dive right into some of the highlights from the last month.

### Funding goals

Does some effort come with a certain - fixed - cost? Or do you have a specific goal in mind? You can now remove the guesswork and set an explicit & public goal for backers to pledge behind.

![](https://blog.polar.sh/content/images/2023/09/Funding-Goal-Asset-1.jpg)

Of course, it's reflected directly in the badge on GitHub for all backers to see. Together, they can pool funding to reach the goal or surpass it.

### Reward contributors on completion

You're merging a PR that closes out an issue for a feature request - it's such a great feeling. Better still, backers have shown their support by pooling funds behind it. #todayinopensource is not too shabby.

However, you couldn't have done it without Lisa. She made a contribution earlier that laid the groundwork for this to happen. So you want to reward her efforts too.

Well, now you can. When marking an issue as completed you can add anyone who deserves a reward.

![](https://blog.polar.sh/content/images/2023/09/Split-asset.jpg)

Can you set rewards upfront? Oh so soon :-) We're working on this now. Join our [Discord](https://discord.gg/STfRufb32V?ref=blog.polar.sh) where we're building in public and have shared designs on what this will look like.

### Backer dashboard

![](https://blog.polar.sh/content/images/2023/09/Recommended-issues.jpg)

In order to drive more funding towards maintainers (our mission) we need to create a world-class experience for backers.

So we shipped a dedicated dashboard for them with some delights:

*   Add issues to fund
*   Track their funded issues
*   See recommended issues to fund based on GitHub stars, popularity and more.
*   Save payment method on file
*   Receive rewards as contributors

We'll continue improving this experience for individuals and teams to help drive more funding towards maintainers.

### API (Early alpha)

![](https://blog.polar.sh/content/images/2023/09/api.jpg)

We're thrilled that a lot of maintainers are excited about Polar - sharing a ton of superb feedback and feature requests (keep them coming). Since we're all developers, they are often in the form of: "If there was an endpoint for X, I'd love to do Y".

So from here on out, we're going to continuously build against a public API. Enabling you to push the boundaries and integrate Polar within your communities, sites and services.

But we're excited to already share an early alpha version of our [public API](https://api.polar.sh/redoc?ref=blog.polar.sh) today. Lots still to do, but we wanted to launch it super early to iteratively improve it together with you, your feedback and use cases.

As an example, using our new [public API](https://api.polar.sh/redoc?ref=blog.polar.sh), Gustav on our team built a [GitHub action](https://github.com/polarsource/actions?ref=blog.polar.sh) to generate & commit markdown of issues to fund for a given repository. You can use it to easily integrate an up-to-date list of fundable issues within your docs or static sites. Super cool!

Join our [Discord](https://discord.gg/zneAsTPUt7?ref=blog.polar.sh) where we're sharing early design sketches for feedback, discussing feature development and more. Great place to share your API use cases and to discuss any improvements needed in our API to empower it. We can't wait to hear from you!

That's it for this update. In the future, we'll share a changelog update for individual features (max once weekly).

/ Polar Team`,
    visibility: 'public',
    author: {
      username: 'polarsource',
      avatar_url: 'https://avatars.githubusercontent.com/u/105373340?v=4',
      verified: true,
    },
    comments: [],
    createdAt: new Date('September 15, 2023'),
    updatedAt: new Date('September 15, 2023'),
  },
  {
    id: 'def',
    title: 'Polar v1.0: Let’s Fix Open Source Funding',
    body: `Today, we’re thrilled to share our v1.0 goals with [Polar](https://polar.sh/?ref=blog.polar.sh) and announce our $1.8M pre-seed round to help us pursue our mission of expanding the open source economy.

Open source is the greatest lever ever for human innovation. Powering all of the products and services that we use and love on a daily basis. Accelerating our ability and velocity to build towards an even better future. Doing it all in the open to push the boundaries of our craft and make knowledge and opportunities accessible to all.

It’s magical. Yet, funding means to strengthen this lever is outdated: Causing unnecessary tension for all parties involved and holding the ecosystem back from its full potential.

**It’s time to move beyond sponsorship & donations**

These models standalone made sense last century when software emerged as a nascent industry built by passionate hobbyists for themselves and their peers. Since then, however, software has “eaten the world”. Dramatically increasing the adoption, usage and reliance on open source from individuals, startups to Fortune 500s.

As a result, questions, bug reports and feature requests are no longer rare and from curious peers. It’s now a constant stream creating an endless backlog of inbound issues. For maintainers, it quickly goes from a hobby to a stressful and unpaid side gig. Turning to sponsorship for support since it’s accessible, but getting little to no return. This dynamic of a growing workload with dwindling support is leading to initiatives being abandoned or worse, maintainer burnout.

In order to get meaningful capital, businesses need to invest. They won’t with the current model. Getting them – and most individuals too – to deploy capital at scale requires a narrative around additional and measurable value in return. Sponsorship offers neither: Emphasizing value given vs. ahead.

Yet, demand is clearly growing significantly for support, issues to be fixed and specific features to be built – all tangible, additional and measurable needs. The problem is we can’t leverage it with current models and workflows redirect it toward fueling the fires:

1.  More issues. _Amplifying maintainer pressure and tensions._
2.  Private forks. _Lost opportunities,_ _massively inefficient and a hidden business expense._

It’s a lose-lose. It’s time to fix it.

**Polar v0.1: Converting issues to a funded backlog**

![](https://blog.polar.sh/content/images/2023/07/image.png)

Today, Polar offers users the ability to seamlessly pledge behind impactful efforts and maintainers to go beyond chronologically sorted issues to a funded and stack ranked backlog.

![](https://lh3.googleusercontent.com/7pHLDEnCKm4-LKmlg9DmcUe6LuE5Mii2nkUTSVpomcC0bZ_fPoLslxjG1HZD1Cas1mZWz4boy0ai9i3eTAREgSEUWI3325DZYUiElbgZFESHtvFkdUBae3HgZuQL59-HwKySCOXnoA8MCXh8J3pa1pg)

Our product is designed to empower maintainers with better insights on what their users want, seek to fund and progress in flight across their community of contributors. All available through our dashboard or directly on GitHub using our Chrome Extension.

Once funded issues are marked completed, maintainers receive 90% of the capital pledged (our commission is 10%). Of course, in case such efforts were achieved together with contributors, maintainers can soon seamlessly split the rewards. Or leverage the capital for community merchandise or meetups to re-investing it behind their own issue dependencies.  

![](https://lh4.googleusercontent.com/Y8ewxSfPHvHgRM3Z3sHdiUZm6obQdedApQWY570856mf8WbJ15eHRYPerREW2T2dndbsGZBZaVbaaDVYIVWj_anCJGxh_WnqIeH8MT_492c2dU7KO7hTzL1eCHA9cnBBBkISNka4HyzmdPu5RADaJoI)

What’s issue dependencies? Whether you’re a maintainer, user or business, Polar offers the ability to easily track all the specific open source issues your own initiatives depend on. By identifying static references to them across internal issues and bringing them to life through our dashboard.

Offering a helicopter view of the state and progress of such dependencies. Making it easy to keep track, plan ahead and seamlessly pledge behind those impactful efforts to support their progress and thereby your own.

We’re just getting started.

**Polar v.1.0: Empowering maintainers to become entrepreneurs**

Our goal is to build a platform for open source maintainers to seamlessly set up, operate and scale value-add services and subscriptions to their backers – individuals and businesses alike.

![](https://blog.polar.sh/content/images/2023/07/Frame-755.jpg)

_**Note:** This is a sketch and not a final version of our v1.0 design._

Crafting on-demand and tiered subscription services tailored to suit their initiative, community and their users’ needs. From a suite of offerings such as:

*   **Prioritized issues.** What Polar is today with more to come.
*   **Backer management & communication.** Automated and streamlined promotions, i.e tiered logos on README/Sites, newsletters, polls etc.
*   **Premium support.** Questions, implementation guidance to consultation scheduling etc.
*   **Premium access**. Educational material, roadmap voting, early or private access to repositories and packages and more.
*   **Custom.** We’ll have a Polar API to enable unlimited creativity for other services you might want to build across your domains and other platforms.

All available in a dashboard designed to make managing these services a delightful experience. In combination with insights and marketing tools to help grow them over time.

Of course, this model is not new. Be it through dual-licensing, sponsorware or hosting in combination with professional support, it’s what defines commercial open source software (COSS) & SaaS. That’s great since such examples showcase the success and opportunities of the model. However, creating and maintaining a growing open source initiative in combination with building the infrastructure behind these services on top is a significant investment. So it’s not surprising that it’s almost exclusively deployed by open source companies with funding.

It’s time to change that. Equipping maintainers across the entire ecosystem with the infrastructure to leverage the same model with ease. In order to create an organic pathway toward independent open source entrepreneurship at scale.

That’s what we’re building towards.

  
**Shape Polar v1.0 with us – built in public & open source**

We’re excited to be building Polar in public and open source ([GitHub](https://github.com/polarsource/polar?ref=blog.polar.sh)). Join our [Discord](https://discord.gg/STfRufb32V?ref=blog.polar.sh) to discuss ideas, early design proposals and upcoming features. We’d love your input and feedback: Let’s shape the future of Polar and the open source economy, together!

**Thank you to our backers**

We’re also thrilled to announce our $1.8M pre-seed to help us pursue this mission. From world-class early stage funds like Mischief & Abstract to some incredible angels like David Cramer, Tristan Handy, Gustaf Alströmer, Carl Rivera, Siavash Ghorbani, Kaj Drobin, Andrea Wang, Fredrik Björk, Joel Hellermark, Sri Batchu and a few more incoming. Thank you for believing in this mission and vision from Day 0 and making this possible!

Let’s build.

_PS. We’ll use Polar ourselves for our open source repository at Polar. However, given that we have funding, we will pledge anything we receive from Polar to our open source dependencies and others._`,
    visibility: 'public',
    author: {
      username: 'polarsource',
      avatar_url: 'https://avatars.githubusercontent.com/u/105373340?v=4',
      verified: true,
    },
    comments: [],
    createdAt: new Date('July 14, 2023'),
    updatedAt: new Date('July 14, 2023'),
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
    id: 'asd',
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
          organizationName: demoEmbedIssuesOrganizationName,
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
