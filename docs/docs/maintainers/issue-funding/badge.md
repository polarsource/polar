---
title: Review & Badge Issues | Maintainers
---

# Review & Badge Issues

## Better Backlog
![Polar Issues View](../../../../assets/maintainers/issue-funding/polar-issues-badge-light.jpg#only-light)
![Polar Issues View](../../../../assets/maintainers/issue-funding/polar-issues-badge-dark.jpg#only-dark)

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
funding & [contributor rewards](/maintainers/issue-funding/reward-contributors) across them.


## Badge Issues

Below is how you can embed the Polar Badge manually in case you did not opt-in to
badge them all automatically in your [settings](/maintainers/issue-funding/getting-started/badge-settings/#embed-settings). Combined with how you can customize funding & rewards for indiviual issues.

### How?

Polar makes this super simple. You can either:

1. Label the issue on GitHub directly using the label `Fund` (case insensitive)
2. Click `Add badge` for the desired issue in your Polar dashboard

    *This will automatically open the [customiztion modal](#customize-badge) below.*

Almost instantly the Polar Badge is embedded at the end of
the GitHub issue description by the Polar GitHub App you've
[installed](/maintainers/issue-funding/getting-started/app-installation) 🎉

![Polar Badged Issue in Dashboard](../../../../assets/maintainers/issue-funding/polar-issue-badged-light.jpg#only-light)
![Polar Badged Issue in Dashboard](../../../../assets/maintainers/issue-funding/polar-issue-badged-dark.jpg#only-dark)
The issue will be marked as badged within your Polar dashboard too. By clicking `Badged` you open up the customization modal (all optional).

### Customize Badge
![Polar Badge Issues Customization](../../../../assets/maintainers/issue-funding/polar-issue-badge-custom-light.jpg#only-light)
![Polar Badge Issues Customization](../../../../assets/maintainers/issue-funding/polar-issue-badge-custom-dark.jpg#only-dark)

#### Badge Description

You can easily tweak or even completely change the default description you setup
during
[onboarding](/maintainers/issue-funding/getting-started/badge-settings#markdown-description)
for a specific issue.

1. Click `Edit` to enable editing
2. Make your changes (markdown supported)
3. Click `Update` to save your changes

#### Funding Goal

Displays a specific goal to backers combined with a progressbar towards it
within the badge.

1. Enter a custom funding goal in USD
2. Click `Update` to save your changes

!!! info "GitHub caches the badge for ~30-90 seconds"
    We set `no-cache` headers and GitHub does support this. However, their proxy CDN
    seems to have a minimal Cache TTL nonetheless, but it's very short-lived
    (with no headers it's cached for much longer).


### Rewards

![Polar Badge Reward Setup](../../../../assets/maintainers/issue-funding/polar-issue-rewards-light.jpg#only-light)
![Polar Badge Reward Setup](../../../../assets/maintainers/issue-funding/polar-issue-rewards-dark.jpg#only-dark)

Want to setup [Contributor
Rewards](/mjintainers/issue-funding/reward-contributors) upfront & promote it
publically? Awesome, let's do it - it's incredibly easy.

1. Switch the `Public rewards` toggle to on (highlighted in blue)
2. Customize the split in percentage you want to allocate to contributor(s) vs.
   yourself

    *Default is 50/50, but you can offer contributors anything from 1% to 100%.
    Did you end up doing everything yourself? Don't worry, you can adjust this
    once the issue is completed before payouts.*

You're done. Changes are saved automatically.

**Boost reward**

Have some prior funding you want to offer yourself to contributors? You can
easily make your own pledge in the modal (invoice sent once issue is completed).

1. Enter the funding amount in USD you want to pledge yourself
2. Click `Pledge`

### Promote

![Polar Issue Funding Promotion](../../../../assets/maintainers/issue-funding/polar-issue-promote-light.jpg#only-light)
![Polar Issue Funding Promotion](../../../../assets/maintainers/issue-funding/polar-issue-promote-dark.jpg#only-dark)

Promoting the ability to fund an issue to your community is a great way to drive
more funding towards it.

#### GitHub Comment

You can post a new comment on the GitHub issue directly from within this view
and the badge will be embedded at the end of the comment.

This has a couple of benefits:

1. Subscribers of the issue receives a notification via GitHub
2. An additional opportunity to capture impressions from new viewers (who might
   scroll quickly to the end)

!!! info "Comments on your behalf"
    If you choose to post a comment via this modal, it will be posted on your
    behalf, i.e

#### Direct Link

1. Click `Copy` to copy the direct link to the issues funding page
2. Share it 🙂


#### Embed Badge Elsewhere

The Polar Badge is an SVG (dark & light mode) that you can bring elsewhere too.

1. Select mode: Dark, Light or Auto
2. Click `Copy` to copy the SVG embed code
3. Paste it wherever there is HTML
