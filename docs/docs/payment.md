---
hide:
  - navigation
---

# Payment & Taxes

## Pricing

Short version: Polar is free to use. When you're making money through Polar, through subscriptions or issue funding, we take a 5% commision (after payment fees).

## Payment (Backers)

Polar uses [Stripe](https://stripe.com) for all payments.
Whether you're pledging to fund an issue or subscribing to an open source maintainer.
Stripe is a leading payment provider and they securely process and store - in case of subscriptions - your credit card details or
other payment methods.

Currently, we support payments to be made in USD only and using the following
payment methods:

- Credit/debit cards
- Apple Pay
- Google Pay

You get a receipt from Polar via Stripe for each transaction made.

### Subscriptions

You can subscribe to maintainers to gain access to additional benefits they offer as part of the selected subscription tier.

By subscribing, you pay the monthly subscription cost and any applicable taxes (see [Taxes](#taxes) below) directly and recurringly
each month thereafter. Billing is therefore done individually per subscription vs. once in case of multiple subscriptions.

**Unsubscribing**

You can find all of your active subscriptions & unsubscribe at any time in your [settings](https://polar.sh/settings).

### Taxes (VAT, Sales Tax, etc)

Subscriptions can be or become subject to value-add taxes, e.g Sales Tax, VAT
etc, depending on the benefits offered and your location - also determening the
amount (%) owed.

In case value-add taxes apply today, it will be specified clearly at the point of
subscribing - both the percentage applied and amount.

In the event taxes apply in the future or apply differently, we will communicate
such changes in advance to you over email before the next billing cycle and you
can decide whether you want to continue subscribing at the updated cost or
unsubscribe in your settings.

### Business Subscriptions

Of course, we support business subscriptions as well. You can provide your local
business registration number at the point of subscribing. It will then be
validated, reflected on the receipt and impact the value-add tax applied.
This includes not adding the value-add tax in case of the reverse charge mechanism being
applicable.


## Fees & Payouts (Creators)


### Fees

Polar has no fixed, monthly, fees. We only earn when you do by taking a 5% revenue share of successful payments.

Stripe transaction- and payout fees apply in addition. _We're covering this up until March 31st, 2024._


### Balance & Payouts

#### Account Setup

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

#### Balance

![Polar Balance](../../../../assets/payment/polar-balance-light.jpg#only-light)
![Polar Balance](../../../../assets/payment/polar-balance-dark.jpg#only-dark)

You can see your available balance for payout at any time under your `Finance`
page.

Your balance is all the earnings minus:

1. Any VAT we've captured for remittance, i.e balance is excluding VAT
2. Our revenue share (5%)
3. Stripe transaction fees (we're covering this until March 31st)

All historic transactions are available in chronological order along with their
associated fees that have been deducted.

Note: Upon payout (withdrawal), Stripe incurrs additional fees that will be
deducted before the final payout of the balance. See next section.

#### Payout (Withdrawal)

You can issue a withdrawal, i.e payout, at any time once there is a balance. We
will then transfer the balance minus Stripe payout fees (see below) to your Stripe account & issue a payout on their
side.

We require this to be done manually since:

1. Users have requested control for easier accounting vs. frequent & small payouts
2. Giving users control of Stripe payout fees


**Stripe Payout Fees**

1. $2 per month of active payout(s)
2. 0.25% + $0.25 per payout
3. Cross border fees (currency conversion): 0.25% (EU) - 1% in other countries.

Given the fixed costs, we want to default to manual payouts so you can control
when you want to incurr them and do it once vs. per each individual transaction
in order to reduce the overall fees.


### Taxes

Polar is building a platform to empower open source maintainers to offer value-add
content, services and subscriptions to their backers. Going beyond donations and
creating more powerful & beneficial opportunities within the open source
ecosystem.

However, such value-add services are often subject to international taxation.
Calculating, capturing and remitting them to separate governmental agencies is almost an impossible overhead and ask from
individual maintainers. **Polar is therefore proud to take this on and to manage value-add taxes for subscriptions offered by maintainers.**

**How it works (Example)**

1. A backer from Sweden wants to subscribe to your $10/month tier.
2. You've setup the $10/month tier to include premium posts (tax applicable) & other custom
   benefits. Given the choice of benefits and their tax settings, Polar
recognizes the tier is subject to taxation.
3. Backer goes to checkout. Automatically, 25% (Swedish VAT) is applied & shown.
They see that the subscription is $10 and $2.5 VAT (25%), i.e $12.5 total per
month.
4. Once they subscribe, payments are made to Polar first. We capture the $2.5
   VAT, deduct Polar & Stripe fees and transfer the rest directly to your
connected Stripe account (setup in Polar dashboard).
5. Polar then declares & remits all VAT in accordance with EU VAT legislation
   via our Irish OSS VAT registration. We deal with the quarterly reporting,
declaration & remittances as the merchant on record.

<ins>Please Note:</ins>

- You are still in charge of personal income tax filings and witholdings of the
  money you receive from Polar. Polar will only capture, report and remit
value-add taxes. Please check with your local authorities or tax professionals for any local filing
requirements you may have personally as a creator.

- International taxes is a complex and evolving topic. Polar works with tax
professionals & lawyers and our best efforts to stay up-to-date, but will
continuously need to adapt the below based on evolving legislation, surpassing local thresholds (see Registrations below), and benefits
offered.

- In case we surpass local value-add tax thresholds in certain markets we're not registered in yet (see [Polar Registrations](#polar-registrations) you already have
subscribers in, we will notify you & the backer ahead of the upcoming
billing cycle. The backer would need to opt-in to the increased monthly cost - increasing chances of churn. We
will therefore also offer you the chance to opt-in for Polar to deduct the necessary taxes
from impacted subscriptions instead if you'd prefer. Of course, new subscriptions would
automatically have the taxes applied at the point of subscribing.

## 1099-K Form (US)

Polar will issue 1099-K forms via Stripe to eligible users in the US on an annual basis.

For tax year 2023, 1099-K forms are required for users who received:

1. $20,000 in gross volume (USD)
2. Over 200 transactions

IRS has expressed intent to lower the threshold to be equilivant to other 1099
forms, e.g NEC, at $600. However, it's still being discussed and is not
guaranteed for 2024 and onward. Stripe keeps the thresholds up-to-date based on
the requirements and their developments.

**Why not a 1099-NEC or 1099-MISC?**

TurboTax has [this great article](https://blog.turbotax.intuit.com/self-employed/1099-misc-or-1099-k-whats-the-difference-29903/) on the difference between 1099-K, 1099-NEC & 1099-MISC

<blockquote>
If you’re self-employed and accept credit, debit, or prepaid cards, you may receive Form 1099-K for transactions processed by a third party. This includes creators, influencers, rideshare drivers, or side-giggers. If you’re an online seller selling on platforms like Ebay, AirBnB, Etsy, and VRBO, you may also receive Form 1099-K.
</blockquote>

Stripe further clarifies 1099-K requirements for Payment Settlement Entities
(PSE) in [this
article](https://support.stripe.com/questions/intro-to-1099-k-tax-forms-for-platforms-and-marketplaces).

Effectively, `1099-K` is required for platforms/marketplaces which:

1. Handles payment between someone providing goods/services to purchasers
2. Such payments are made with credit, debit, or prepaid cards.
3. Receiver is not a contractor/freelancer to the platform/marketplace

Polar meets all of these criterias and therefore issues 1099-K forms to eligible
developers on the platform vs. other forms.

## Polar Registrations

Currently, Polar has the following registrations:

1. US (Delaware). *Polar Software Inc. is incorporated here.*
2. EU VAT (Ireland OSS VAT)
3. UK VAT. *Registration in progress*

Many states and countries only require value-add taxation after a certain
threshold. Polar does not apply value-add taxes until such thresholds are
reached and will continue to monitor, expand and register for local taxation
based on their legislations to the best of our abilities.

*Note: Each registration comes at both an upfront and ongoing cost. Polar does
not guarantee to support all countries short-term and will focus expansion on markets with
the most demand and potential for maintainers.*
