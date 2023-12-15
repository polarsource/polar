---
title: Funding Workflow | Maintainers
---

# Funding Workflow

## Review Backlog
![Polar Issue Progress Overview](../../../../assets/maintainers/issue-funding/polar-issue-progress-light.jpg#only-light)
![Polar Issue Progress Overview](../../../../assets/maintainers/issue-funding/polar-issue-progress-dark.jpg#only-dark)

Polar synchronizes all of your issues during
[onboarding](/maintainers/issue-funding/getting-started/app-installation) & keeps them up-to-date
in near real-time (thanks to GitHub webhooks).

Combined with offering some powerful additions such as...

**Progress overview**

- Showcases PRs referencing the issue & their statuses
- Commits referencing the issue
- Funding progress & backers


**Sort by community impact**

- **Most wanted (Default):** Thumbs-up reactions & funding.
- **Most reactions:** Total count of positive reactions, e.g thumbs-up.
- **Most engagement:** Combintation of reaction & comment count.
- **Pledged amount:** Issues by total funding amount.
- **Recently pledged:** Issues by when they last received funding.
- **Newest:** Newly submitted issues.
- **Relevance:** Relevant issues by search term.

... and of course the ability to seamlessly embed & manage the Polar Badge,
funding & contributor rewards across them.


## Badge Issues

![GitHub Issue with Polar Badge](../../assets/maintainers/issue-funding/gh-badged-dark.jpg#only-dark)
![GitHub Issue with Polar Badge](../../assets/maintainers/issue-funding/gh-badged-light.jpg#only-light)

In case you did not opt-in to
badge all issues automatically in your
[settings](/maintainers/issue-funding/getting-started/badge-settings/#embed-settings)
you can easily do so manually. You can either:

1. Label the issue on GitHub directly using the label `Fund` (case insensitive)
2. Click `Add badge` for the desired issue in your Polar dashboard

    *This will automatically open the [customiztion modal](#customize-badge) below.*

Almost instantly the Polar Badge is embedded at the end of
the GitHub issue description by the Polar GitHub App you've
[installed](/maintainers/issue-funding/getting-started/app-installation) 🎉

![Polar Badged Issue in Dashboard](../../../../assets/maintainers/issue-funding/polar-issue-badged-light.jpg#only-light)
![Polar Badged Issue in Dashboard](../../../../assets/maintainers/issue-funding/polar-issue-badged-dark.jpg#only-dark)
The issue will be marked as badged within your Polar dashboard too.

### Customize

You can customize funding & badge settings for individual issues to override
your [default
settings](/maintainers/issue-funding/getting-started/badge-settings). Just click the
`Badged` button next to the desired issue on the `Issues` page within Polar.

This opens up the customization modal. Let's go through each tab below.

#### Funding
![Polar Badge Issues Customization](../../../../assets/maintainers/issue-funding/polar-issue-badge-custom-light.jpg#only-light)
![Polar Badge Issues Customization](../../../../assets/maintainers/issue-funding/polar-issue-badge-custom-dark.jpg#only-dark)

##### Badge Description

You can easily tweak or even completely change the default description you setup
during
[onboarding](/maintainers/issue-funding/getting-started/badge-settings#markdown-description)
for a specific issue.

1. Click `Edit` to enable editing
2. Make your changes (markdown supported)
3. Click `Update` to save your changes

##### Funding Goal

Displays a specific goal to backers combined with a progressbar towards it
within the badge.

1. Enter a custom funding goal in USD
2. Click `Update` to save your changes

!!! info "GitHub caches the badge for ~30-90 seconds"
    We set `no-cache` headers and GitHub does support this. However, their proxy CDN
    seems to have a minimal Cache TTL nonetheless, but it's very short-lived
    (with no headers it's cached for much longer).


#### Rewards

![Polar Badge Reward Setup](../../../../assets/maintainers/issue-funding/polar-issue-rewards-light.jpg#only-light)
![Polar Badge Reward Setup](../../../../assets/maintainers/issue-funding/polar-issue-rewards-dark.jpg#only-dark)

Want to setup contributor rewards upfront & promote it publically (optional)? Awesome,
let's do it - it's incredibly easy.

1. Switch the `Public rewards` toggle to on (highlighted in blue)
2. Customize the split in percentage you want to allocate to contributor(s) vs.
   yourself

    *Default is 50/50, but you can offer contributors anything from 1% to 100%.
    Did you end up doing everything yourself? Don't worry, you can adjust this
    once the issue is completed before payouts.*

You're done. Changes are saved automatically.

##### Boost reward

Have some prior funding you want to offer yourself to contributors? You can
easily make your own pledge in the modal (invoice sent once issue is completed).

1. Enter the funding amount in USD you want to pledge yourself
2. Click `Pledge`

#### Promote

![Polar Issue Funding Promotion](../../../../assets/maintainers/issue-funding/polar-issue-promote-light.jpg#only-light)
![Polar Issue Funding Promotion](../../../../assets/maintainers/issue-funding/polar-issue-promote-dark.jpg#only-dark)

Promoting the ability to fund an issue to your community is a great way to drive
more funding towards it.

##### GitHub Comment

You can post a new comment on the GitHub issue directly from within this view
and the badge will be embedded at the end of the comment.

This has a couple of benefits:

1. Subscribers of the issue receives a notification via GitHub
2. An additional opportunity to capture impressions from new viewers (who might
   scroll quickly to the end)

!!! info "Note: Comments on your behalf"
    In case you submit a comment via the modal (optional), it will be posted on
    your behalf. This is mentioned next to the `Post` action so it's never a
    surprise. Additionally, GitHub will add the Polar logo in connection with
    your avatar for the comment - indicating it was done via the Polar App.

##### Direct Link

1. Click `Copy` to copy the direct link to the issues funding page
2. Share it 🙂


##### Embed Badge Elsewhere

The Polar Badge is an SVG (dark & light mode) that you can bring elsewhere too.

1. Select mode: Dark, Light or Auto
2. Click `Copy` to copy the SVG embed code
3. Paste it wherever there is HTML

## Complete Issues

![Polar Issue Progress Overview](../../../../assets/maintainers/issue-funding/polar-issue-progress-light.jpg#only-light)
![Polar Issue Progress Overview](../../../../assets/maintainers/issue-funding/polar-issue-progress-dark.jpg#only-dark)

Polar is deeply integrated with GitHub and your usual workflow. Draft, merged or
active PRs and commits referencing your issues are automatically detected and
showcased upfront. Updated in near real-time.

So you can focus on making progress with contributors vs. tracking it.


### Mark as Completed

![Polar Issue Progress Overview](../../../../assets/maintainers/issue-funding/polar-issue-completed-light.jpg#only-light)
![Polar Issue Progress Overview](../../../../assets/maintainers/issue-funding/polar-issue-completed-dark.jpg#only-dark)
Once an issue is closed - in case it has received funding - we'll prompt you via
email and in our dashboard to mark it as completed. We require this manual step
to avoid triggering the actions below prematurely or by mistake.

- **Invoicing**. Backers who made pledges receive their invoices due within 7
    days
- **Review**. Backers who paid upfront are notified and have a 7 day dispute
  window.
- **Rewards**. You can split funding with contributors during the 7 day
    waiting period.

### Reward Contributors

![Polar Issue Reward Contributors](../../../../assets/maintainers/issue-funding/polar-reward-prompt-light.jpg#only-light)
![Polar Issue Reward Contributors](../../../../assets/maintainers/issue-funding/polar-reward-prompt-dark.jpg#only-dark)

The modal above will appear once you've marked an issue as completed. Polar will
automatically suggest contributors from merged PRs referencing the issue. Making
it super simple to share funding with them.

- It's optional
- You can reward contributors even if you didn't setup a public reward upfront
- We highlight whether a public reward was set and if so...
- Automatically distribute the contributor split evenly across all contributors
- You can adjust the shares freely

Once you're done and click `Confirm` you can easily share the great news with
the contributors in the form of a GitHub comment. You can edit the suggested
comment freely. Just make sure to keep the username pings & instructions 🙂

![Polar Issue Reward Comment](../../../../assets/maintainers/issue-funding/polar-reward-comment-light.jpg#only-light)
![Polar Issue Reward Comment](../../../../assets/maintainers/issue-funding/polar-reward-comment-dark.jpg#only-dark)

### Receive Funding

Great. You've setup funding, hacked away with contributors to complete the issue
and shared some rewards. Now what?

#### Setup Payouts

![Polar Account Setup](../../../../assets/maintainers/issue-funding/polar-account-nudge-light.jpg#only-light)
![Polar Account Setup](../../../../assets/maintainers/issue-funding/polar-account-nudge-dark.jpg#only-dark)

You need to setup an account so that we can transfer the funding - minus our fees - to it.

1. Goto the `Finance` page in your Polar dashboard
2. Click `Setup` in the card shown above in your dashboard
3. Choose account type & follow their setup instructions

*This is only required the first time and you can do this proactively too in order - recommended to avoid
any additional delays.*

##### Stripe Connect Express

![Polar Stripe Account Setup](../../../../assets/maintainers/issue-funding/polar-account-stripe-setup-light.jpg#only-light)
![Polar Stripe Account Setup](../../../../assets/maintainers/issue-funding/polar-account-stripe-setup-dark.jpg#only-dark)

Stripe is the default and recommended option since it enables instant transfers.

##### Open Collective

![Polar Stripe Account Setup](../../../../assets/maintainers/issue-funding/polar-account-oc-setup-light.jpg#only-light)
![Polar Stripe Account Setup](../../../../assets/maintainers/issue-funding/polar-account-oc-setup-dark.jpg#only-dark)

We support the ability to easily connect a verified Open Collective account to
Polar. However, such transfers are done manually vs. automatically via an API
(such as Stripe) and therefore we only do them:

- Once per month
- For accounts reaching a $100 minimum threshold

!!! info "Open Collective fees apply in addition"
    We only support Open Collective accounts using the Open Source Collective
    fiscal host and their fees apply in addition to offer their services on top.

#### Await Payouts

Once you mark an issue as completed backers receive an email notification about
it and have 7 days to either:

- **Dispute**. In case they paid upfront and want to dispute the completion.
- **Pay invoices**. In case they made a pledge to pay on completion.

Polar then reviews and approves transfers from our platform account to your
connected account. In case of disputes, we review it to make a fair decision.

If you're using Stripe you will almost immediately see the transfer on your
Stripe Connect Express account. Those funds will then be paid out to your bank based on
your Stripe Payout schedule.
