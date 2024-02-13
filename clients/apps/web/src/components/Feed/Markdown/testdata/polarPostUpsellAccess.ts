export const polarPostUpsellAccess = `![Hero image](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/GitHub%20Repo-N4Yx3M434zkSTK3qQHubUyVNwXDohp.png)

You can now seamlessly offer subscribers on Polar access to one, two, three... or countless private GitHub repositories 🎉 This opens up and streamlines unlimited possibilities, monetization- and funding models. 

Open source developers can use it to offer:
- Access to private GitHub discussions & issues for sponsors
- Early access to new feature development before upstream push
- Sponsorware
- Premium educational materials & code

Indie developers can use it to sell:
- Self-hosting products
- Courses
- Starter kits
- Open core software

We're also the merchant of record and take care of VAT.

Paired with premium [Posts & Newsletters](https://polar.sh/polarsource/posts/polar-creator-platform-for-open-source-developers), [Discord invites](https://polar.sh/polarsource/posts/upsell-discord-invites) and [Ads](https://polar.sh/polarsource/posts/automate-sponsor-logos-ads) open source developers can easily offer an unparalleled sponsorship & membership offering. To building an independent commercial open source initiative. You can even build a developer-first SaaS offering.

Of course, using our API & SDK all of these capabilities can easily be integrated & upsold on your own site or service too.

Polar is built by developers, for developers, and [open source](https://github.com/polarsource/polar). We want to empower a new generation of independent developers pursuing their passions full-time. So subscribe to get future product updates & posts as we'll write a series diving deep into all of the opportunities Polar can help facilitate for developers.

Or better yet: Start building with Polar today - [signup now](https://polar.sh).

<iframe src="https://www.youtube.com/embed/QKx4o0z-SVY"></iframe>

## Let's create a Polar subscription benefit for a GitHub repository

Let's rig it up and see how it works.
1. Goto \`Subscriptions\` in your dashboard and then click \`Edit tier\` on your default **Free** tier (for newsletters) to try it out
2. Click \`New Benefit\` (See below)

![Create new benefit](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-ILn7PLAZL2eck6O9rKHCJIO4Nlgd4U.png)

- Select \`GitHub Repository Access\` as the benefit type
- Select the \`Organization\` the private repository belongs to or connect an organization (See notes below)

**Why organization vs. personal account?** GitHub limits personal accounts to only invite collaborators without controlling their permissions, e.g committing to \`main\`, pushing new releases etc. Organizations can set more restrictive permissions, e.g read-only. Therefore, due to the security risks, we've put support for personal accounts with this benefit behind a feature flag - reach out if you want it enabled anyway.

**Important pricing note:** Collaborators are considered a seat on paid plans and you'll be billed accordingly. We therefore request read-only access to your organizations billing plan to warn about this in our UI so that you can price your Polar subscription to cover it.

- Click \`Install\` to install the required Polar GitHub App

![Create benefit - Install GitHub App](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-h5l5CsSZ3SI7LBg4Mx5fzokNzjpE6S.png)

You'll be redirected to the GitHub App installation flow to grant access to select repositories. You can choose one of them, a select few or all of them.

**Important note:** Selected repositories here are not automatically granted to subscribers on Polar. You'll explicitly select the one (1) desired repository to grant access to for the given subscription benefit you create on Polar. You're in complete control. Of course, you can create multiple benefits to grant access to numerous repositories, but they're all added explicitly.

![GitHub installation flow](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-0GzjfOkdRqj0QyA07DqFIRstDbsouo.png)

*Bonus: The Polar GitHub App will also enable you to use the issue crowdfunding & contributor rewards features with Polar too 🔥. They require read/write to issues & pull requests while administration is required for managing invites to desired GitHub repositories. Unfortunately, GitHub does not offer progressive permissions for Apps.*

Once the Polar GitHub App has been installed you'll be taken back to Polar to continue the setup of the subscription benefit.
1. Select the private \`Repository\` you want to grant subscribers access to
2. Select the desired GitHub \`Role\`, e.g \`Read\` for read access only.
3. Click \`Create\`

![Select repository & role](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-MenUSRBNEXfw5ZmFkt5uP6Ffsh0I3q.png)

We can now review our updates to the *Free* tier and see our added GitHub Repository Access benefit we call \`Cutting edge\`. We can also update our tier description to celebrate the new benefit.

![Review tier](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-Z1UfL9ilQFHM64fMqIM3G6vI51bNSv.png)

Looks great. Let's click \`Save Tier\` and try it out as a subscriber. 

## Subscribers accessing GitHub repository

![Subscribe](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-sGIzRl0if9LmJd9lWhaGDpd6bLnsn3.png)

Your audience can now see the benefit and easily subscribe to gain access to it. In case of email subscriptions, we'll prompt them to connect a GitHub account and immediately create the repository invitation once they have.

Subscribers can see & manage their subscription benefits under \`My Subscriptions\`. 

Look at that, they now see the \`Cutting edge\` repository with a convenient activation link to it. 

*Note: They also receive an email invitation from GitHub.*

![Gain access to repo via subscriptions](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-RxC5k4B9QPNxTGwYZUXhsjpjzKxgEw.png)

So let's click the \`Goto polardemo/cutting-edge\` link. Since it's our first time, we're prompted to accept the invitation first.

![Accept invitation](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-qyWQF7WGTkld5JzcbZmvAYjibjspE7.png)

... and that's it. We're in! 

![Subscriber seeing the repository on GitHub](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-RMwsZSbqgWak7MfKjLjLPD8f25U3jq.png)


## Manage collaborators

![image.png](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-Ihx3RL0EIobi7KlULBBvfeDYleStKA.png)

You can of course review and manage your collaborators on GitHub. As seen above, our subscriber is now a collaborator with \`Read\` permissions. Just like we wanted.

Oh, and of course, Polar will automatically remove collaborators once their subscription is no longer valid, i.e cancelled.

---------------------

In this example, we've setup seamless invitations to one (1) GitHub repository. However, it's the same process to add additional benefits for more repositories. So there's no limit to how creative you can get with your offerings - we can't wait to see some of your examples!

Finally, make sure to subscribe below to stay up-to-date as we ship more product updates & write a series going deeper into different models Polar can help facilitate.

Until next time, keep building!

`
