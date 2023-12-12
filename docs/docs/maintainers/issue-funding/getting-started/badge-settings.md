---
title: Customize Badge | Maintainers
---

# Customize the Polar Badge

Epic! Polar is now installed across your chosen GitHub repositories and you've
been redirected back to Polar. We're at the last - required - step: Customize the Polar Badge
settings for your repositories.

![GitHub Issue with Polar Badge](../../../../assets/maintainers/issue-funding/gh-badged-dark.jpg#only-dark)
![GitHub Issue with Polar Badge](../../../../assets/maintainers/issue-funding/gh-badged-light.jpg#only-light)


## Goal

Users stumble upon impactful & relevant issues to them. Usually, they would
hammer the 👍 and perhaps even write a "+1" comment. But now, they also see that
they can do more; they can collectively pool funding towards it to support you
and your contributors in your efforts to complete it.

* Beautiful & non-intrusive SVG
* Promotes funding - link to Polar pledge page for given issue
* Embeddad at the end of the GitHub issue description
* Seamlessly integrated with GitHub vs. creating noise in issue threads via
  comments
* Updates automatically to show funding progress & backers
* Promote an allocated reward to potential contributors - a percentage of
  funding (optional)

*Checkout an example on a GitHub issue: [SerenityOS/serenity#22179](https://github.com/SerenityOS/serenity/issues/22179)*

Let's get this beaut setup for you.

## Setup

Once you've [installed the Polar GitHub
App](/maintainers/issue-funding/getting-started/app-installation) you'll be
redirected back to Polar and the screen below. Let's go through it - together.

![Customize Badge Settings](../../../../assets/maintainers/issue-funding/polar-badge-setup-light.jpg#only-light)
![Customize Badge Settings](../../../../assets/maintainers/issue-funding/polar-badge-setup-dark.jpg#only-dark)


### Badge Settings

#### Markdown description

Custom markdown text to be inserted before the Polar Badge. Great way to offer
additional and personal context. We offer a default suggestion, but you can easily
edit it and even remove it entirely.

#### Minimum funding amount

The minimum amount required for funding by individual backers (default is `$20`)

#### Public rewards

Enable & promote a default percentage split of the funding pool with potential
contributors who help squash an issue.

!!! tip "Feedback"
    Missing something? We'd love to chat and improve the product based on your
    feedback!

    You can submit a feature request via GitHub (we're building open source).
    You're also more than welcome to join our Discord. [Relevant links](/support/)

### Embed Settings

So we have our badge setup & ready - amazing! Let's configure how we want to
embed it for each repository.

#### Manual: Issues by Label

This is the default setting and a great way to try things out. You then have
complete control of which issues you want to embed the Polar Badge on using the
label `Fund` (case insensitive).

- You can label via GitHub directly and see the badge embedded within seconds
- You can label & badge an issue with one-click through the Polar dashboard

#### Automated: All Issues

Ok, you're loving it. Let's unleash it across all issues to promote funding to
our community and let them help vote & fund the most impactful efforts. Combined
with using rewards to distribute it across your contributors. Just like [tRPC](https://twitter.com/trpcio/status/1716747233121464346) has.

- `All` will ensure all future issues are badged automatically & directly upon
  creation

- You'll get the option to badge all existing - open - issues too. However, for
  safety, we show how many issues would be updated and require you to
  explicitly confirm & trigger this action.


!!! info "How GitHub issue ordering is affected by multiple updates"
    Since we update the issues to embed the Polar Badge the issues will get an
    updated `modified_at` timestamp.

    By default, GitHub issues is sorted by `created_at` so it's not impacted
    unless you specifically sort by `modified_at`.

    However, when & if you select to badge all existing - open - issues, we do
    so in a batch and in reverse chronological `modified_at` order. So that even
    though we update them we do so in a way that should retain their previous order.
    We cannot promise, however, that it will guaranteed.


## Next Step

You're now officially done with the maintainer onboarding 🎉 Go ahead and
badge all the issues you want & checkout how you can [promote
it](/maintainers/issue-funding/getting-started/promote) further for a
higher chance of success.

We're honored to have you onboard! Don't hesitate to reach out and share how we
can improve at any point. We have ambitious plans & a lot of exciting features in store.
