---
title: Maintainers
---

# Maintainers


## Pricing

### What does Polar cost?

Polar has no fixed, monthly, fees. We take a 10% commission once transfers are 
made for successfully funded & completed issues.


## Issue Funding

### Can any issue be funded?

Yes, backers can fund any issue on GitHub by:

1. Going to `polar.new` and entering a link to an existing issue
2. Replacing `github.com` with `polar.sh` in the GitHub issue URL
3. Clicking `Fund` on the Polar badge embedded within the issue by the maintainer

Most backers discover & fund issues via #3 which is proactively approved &
promoted by you. Options #1-2 exist to make additional funding frictionless and
offer inbound signals from your community. However, it's completely up to you as a maintainer
whether you accept & want to promote additional funding towards those issues.

---

### What is the Polar badge?

A beautiful, subtle and automatically generated SVG promoting funding for an
issue at the bottom of its' description. Checkout a [live example](https://github.com/sindresorhus/type-fest/issues/213).

You can customize:

- **Contextual description.** Custom markdown to be embedded before the SVG to
  provide additional context - we have a default suggestion.
- **Funding goal.** Set a target to be displayed along with the progress towards
  it.
- **Minimum funding amount.** Default is $20 otherwise.
- **Upfront split with contributors (Rewards).** Set & promote a percentage which
  will be rewarded to contributors who help close it.

---

### How can I embed the Polar badge?

You don't have to do it manually. Polar makes it seamless for you as a
maintainer.

[Signup to Polar](https://polar.sh/signup/maintainer) as a maintainer to:

1. Grant access to repositories (read+write to issues)
2. Customize your settings for the badge
3. Setup badges to be embedded on all issues automatically OR by label (`Fund`)

You can then easily embed badges across issues in one of the following ways:

- **All existing & open issues.** Requires an explicit action - only available
  if you've opted into adding the badge to all issues.
- **Individual issues in Polar.** We make it easy (one-click)
  to embed & customize the badge for individual issues directly within Polar.
- **Add label on GitHub.** You can label any issue via GitHub with `Fund` and
  Polar we'll shortly thereafter embed the badge.

*Note: This updates the issue and thereby the modified_at timestamp of it on
GitHub. However, default sorting on GitHub is by created_at so it's unaffected.
We also update issues in reverse chronological order if you badge all historic issues at once.
Thereby retaining the same sorting even with updated modified_at timestamps.*

---

### How do I promote funding?

Below are all of our recommendations, but they're all optional. You know your
community best and what works for you.

1. **Embed the Polar badge on issues.** Makes it seamless for backers and promotes
   it organically at the best point in time (shown interest).
2. **Embed additional Polar assets on GitHub.** In the "Promote" page of your Polar
   dashboard we offer dynamic badges you can embed in the README of your
   repository. Combined with how you can add your public Polar page (showing all
   fundable issues) to your `FUNDING.yml` to promote it underneath "Sponsor this
   project" on GitHub.
3. **Announce & Promote funding to your community.** Share your Polar page or individual issues on X/Twitter, Discord, Reddit
   or wherever your community lives. Checkout how
   [tRPC](https://twitter.com/trpcio/status/1716747233121464346) or
   [SerenityOS](https://twitter.com/awesomekling/status/1719086131315171698) did
   it for inspiration.

---

### What is the difference between upfront funding & pledges?

**Funding (Paid upfront):** Backers pay immediately and funds are held by Polar. Once
the issue is completed and no disputes are made, funds are transferred to you.

**Pledges (Paid on completion):** Backers opt to pay using invoice once the
issue has been completed. We require such backers to have a connected GitHub
account for social validation & review by you.

Of course, pledges are less of a gurantee. Yet, they are often preferred for
larger amounts & by companies, and can offer higher conversion. We clearly
distinguish them in your Polar dashboard so you can review them easily in terms
of trustworthiness.

---

### Does funding expire?

Yes, after 6 months backers are eligible to request the funds to be distributed
elsewhere using Polar.

---

### Do I have to solve all funded issues?

No. Uncompleted issues will eventually lead to expiration of the funding.

---

### Do backers get additional rights?

No. Our [Terms of Service](https://polar.sh/legal/terms) is written to ensure
backers have no additional claims or rights beyond what your current license
provides. Fairly enough, this goes both ways, i.e you're not allowed to promote
funding for an issue only to release it under a different license - unless
backers are granted permission to such a license.

---

### How do I reject funding for an issue?

Currently, in our alpha we have not automated management of this scenario since it has not been requested yet. We will once it becomes requested and in the meantime you can:

1. Ignore it
2. Reach out to [support@polar.sh](mailto:support@polar.sh) and we'll refund &
   remove it

## Reward Contributors

### Can I share funding with contributors?

Yes and seamlessly so. We call it `Rewards`. Read more about Rewards [here](https://blog.polar.sh/introducing-rewards/).

---

### How do I share funding with contributors?

Once an issue is closed you'll be promoted to mark it as completed within Polar.
Triggering notifications to backers and invoices for those who made pledges.

Simultaneously, you'll then be asked to specify contributors you want to share
the funding with and their corresponding amount (%). We automatically suggest
users who have made a PR referencing the issue and an even split across all
parties (easy to adjust).

Finally, in case you're seeking to reward contributors, we'll prompt you to
notify them in a comment on the issue. We'll automatically generate a suggested
comment you can review & post easily from our dashboard as part of this process.

*Note: We'll attempt to notify them otherwise. However, we think you deserve the
credit & opportunity to do so first.*

---

### Can I use rewards like bounties?

Yes. You can set an upfront split (100%) to contributors and promote it within the
Polar badge & page. You can also easily self-fund it. Together, that's all that
is required to create a traditional bounty paid by you.

With the added benefit of other community members being able to pool capital
behind it as well.

However, unlike traditional bounty solutions, we don't currently maintain a
public directory of such rewards/bounties. Since such directories have historically
attracted the wrong incentives, poor contributions and added overhead. Instead
of rewarding your community. [Read
more](https://blog.polar.sh/introducing-rewards/) about this design choice.


---

### Is there a public directory of all rewards?

No. [Read more here](https://blog.polar.sh/introducing-rewards/) on why this is and
our thinking behind it.

## Payouts

### How do I receive funding?

Polar is built on Stripe Connect. You can seamlessly create and connect a Stripe
account directly within your Polar dashboard provided you live in a [supported country](#which-countries-are-supported).
Funds will then be automatically transfered once they're ready and subsequently paid out to your bank account from Stripe.

---


### When are funds paid out?

Once you mark an issue as completed, we give backers a 7-day dispute & payment window (pledges). After which, we'll transfer
the available funds (minus our commission & fees) to your connected Stripe account.

You then receive Stripe payouts to your bank account based on your [Stripe Payout Schedule & Speed](https://stripe.com/docs/payouts#payout-schedule).

---

### Why do I need to manually mark an issue as completed on Polar?

Once an issue is closed on GitHub we are notified almost instantly (webhooks). However, the next step
is for backers to be notified, review and pay any outstanding invoice (pledges).

To prevent such notifications & actions happening prematurely and by mistake, e.g bots closing
"stale" issues etc, we prompt you to explicitly mark it as completed. This step
also includes additional actions, e.g setting up rewards proactively to
contributors (if desired).

---

### Can I use Open Collective instead of Stripe?

Yes. You can connect an Open Collective account instead of Stripe. However, such
transfers are made manually by Polar. We do them on a monthly basis and only
when funds exceed $100 to any given account.

## Supported Platforms, Countries & Currencies

### Does Polar only support GitHub?

Yes. Our long-term goal is to expand to other platforms too, but we'll remain
focused on GitHub exclusively until we've had sufficient impact there.

Interested in GitLab support? [Upvote the feature request](https://github.com/orgs/polarsource/discussions/852)

Interested in others? [Submit a feature request](https://github.com/orgs/polarsource/discussions/categories/feature-requests)

---

### Which currency is funding made & transferred in?

Today, we only support funding in USD and show it in USD across our entire
product.

However, once we transfer the funds to your connected Stripe Express account,
Stripe will convert it into the applicable currency of the account.

---

### Which countries are supported?
Polar is built on Stripe Connect and currently supports the following list of
countries:

- Austria
- Belgium
- Bulgaria
- Canada
- Croatia
- Cyprus
- Czech Republic
- Denmark
- Estonia
- Finland
- France
- Germany
- Greece
- Hungary
- Ireland 
- Italy 
- Latvia 
- Lithuania 
- Luxembourg 
- Malta 
- Netherlands 
- Norway 
- Poland 
- Portugal 
- Romania 
- Slovakia 
- Slovenia 
- Spain 
- Sweden 
- United Kingdom
- United States
