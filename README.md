<p align="center">

  <a href="https://polar.sh">
      <img src="https://github.com/polarsource/polar/assets/281715/98fa24e4-7289-46a3-8afb-db818bf17f74" />

  </a>

</p>

<hr />
<div align="center">

<span>Public Beta - <a href="https://polar.sh/signup/maintainer">Get started</a></span>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://polar.sh">Website</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://polar.sh/polarsource">Blog</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://docs.polar.sh/">Docs</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://docs.polar.sh/api/">API</a>



<p align="center">
  <a href="https://github.com/polarsource/polar/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="Polar is released under the Apache 2.0 license." />
  </a>

  <a href="https://discord.gg/STfRufb32V">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>

  <a href="https://twitter.com/intent/follow?screen_name=polar_sh">
    <img src="https://img.shields.io/twitter/follow/polar_sh.svg?label=Follow%20@polar_sh" alt="Follow @polar_sh" />
  </a><a href="https://polar.sh/polarsource"><img src="https://polar.sh/embed/seeks-funding-shield.svg?org=polarsource" /></a>
</p>
</div>
<hr />

## Polar.sh: A Patreon for Open Source Developers
A creator platform for developers and the open source ecosystem – built open source (Apache 2.0).

Offering you – as a developer –  a platform on top of your GitHub repositories to:

- Build, own & reach your audience through free- and premium posts and newsletters.
- Offer subscriptions of value-add benefits designed for our ecosystem & built-in to Polar. We'll handle value-add taxes.
- Get funding behind your GitHub issues & split it with contributors (Rewards)
- Integrate it all on your own docs, sites or services using our API & SDK.

### Subscriptions

- **Reach your entire audience with free tier(s).** You can build, grow & reach your entire audience (you own it and can export them at any time). They can subscribe for free with email-only and upgrade to paid later. Substack-style.
- **Polar handles value-add taxes for paid tier(s).** We're proud to be the merchant of record & manage value-add taxes to enable this for individual developers.
- **Unique business subscriptions.** Enabling all their team members to gain access to benefits. Offering unparalleled opportunities and value to subscriptions offered via Polar to businesses.
- **Powerful, built-in, benefits.** Going beyond free text upsells to built-in services you can easily manage via Polar. Delightful for backers to consume.

We're going to invest heavily in automating typical benefits offered within the open source ecosystem. Making it seamless for you to manage & delightful for your backers to use. Some ideas in our pipeline short-term:

- **Discord invites (unique roles per tier)**
- **Sponsor Logo Automation.** Businesses can setup their logotype & description once and it automatically propagating across your README (PR/SVG) to sites/docs (SDK)
- **Early access (private repo collaborators)**
- **Sponsored Posts**

_You can read more about this, posts & newsletters on our blog [here](https://polar.sh/polarsource/posts/polar-creator-platform-for-open-source-developers)._

### Posts & Newsletters
![image](https://github.com/polarsource/polar/assets/281715/35be6500-21b4-4cb4-956d-17e8616bf161)

**Features**
- Public posts
- Premium posts (paid subscribers)
- Hybrid, i.e public with paywall sections
- Publish online
- Send email (newsletters)
- Schedule posts

**Editor & Content**
- Markdown editor
- Preview on web & email
- Syntax highlighting
- Youtube embeds
- Issue embeds with funding promotion
- Subscribe Now-button embeds
- Paywall sections to paid subscribers
- Drop images to embed them
- _More to come_

### Issue Funding & Contributor Rewards
![image](https://github.com/polarsource/polar/assets/281715/89ab2fd6-8491-4706-b49f-8c6fcca2d34f)

- Your users can pool funding behind issues/feature requests
- Beautiful Funding SVG to automatically embed on select issues
- Set public funding goals
- Split funding with contributors - PR authors automatically suggested
- Setup public rewards, i.e a percentage split to promote in advance
- Fund such rewards yourself, i.e bounties.

However, Issue Funding & Contributor Rewards on Polar is built for maintainers, not bounty hunters. You can read more about this feature and our principles around it [here](https://polar.sh/polarsource/posts/introducing-rewards).

### Polar API & SDK
You can integrate Polar on your docs, sites or services using our [Public API](https://docs.polar.sh/api) and/or our [Polar JS SDK](./clients/packages/sdk) (Beta)

## Pricing

- No fixed, monthly, costs
- 5% (Polar) + payment & payout fees (Stripe)
- _We'll also cover Stripe fees from our 5% until March 31st, 2024._

## Roadmap, Issues & Feature Requests
[Join our Discord](https://discord.gg/STfRufb32V) or [GitHub Discussions](https://github.com/orgs/polarsource/discussions) to help shape the future of Polar and to see what we're working on. We're excited to hear from you!

**🐛 Found a bug?** [Submit it here](https://github.com/polarsource/polar/issues).

**🔓 Found a security vulnerability?** We greatly appreciate responsible and private disclosures to security@polar.sh. See [Security](./README.md#Security)

## Contributions

You can develop on Polar in GitHub Codespaces. The environment is pre-configured to contain (most) of the tools that you'll need, and will help you to configure the integration between Polar and GitHub (see [.devcontainer/README](./.devcontainer/README.md)). Using an instance with at least 4 cores is recommended.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/polarsource/polar)

You can also develop on Polar locally on your computer, which is the recommended way of working if you want to get into the deep of how Polar works. Documentation on how to setup a development environment is incoming. Until then, if you're feeling adventurous checkout our repository structure below and [clients/README](./clients/README.md) and [server/README](./server/README.md) in particular.

### Contributors
<a href="https://github.com/polarsource/polar/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=polarsource/polar" />
</a>


## Monorepo
* **[server](./server/README.md)** – Python / FastAPI / Arq / SQLAlchemy (PostgreSQL) / Redis
* **[clients](./clients/README.md)** – Turborepo
  * [web](./clients/apps/web) (Dashboard) – NextJS (TypeScript)
  * [chrome-extension](./clients/apps/chrome-extension) – React (TypeScript) - _To be deprecated_
  * [polarkit](./clients/packages/polarkit) - Shared React components
  * [SDK](./clients/packages/sdk) - Polar SDK

<sub>♥️🙏 To our `pyproject.toml` friends: [FastAPI](https://github.com/tiangolo/fastapi), [Pydantic](https://github.com/pydantic/pydantic), [Arq](https://github.com/samuelcolvin/arq), [SQLAlchemy](https://github.com/sqlalchemy/sqlalchemy), [Githubkit](https://github.com/yanyongyu/githubkit), [sse-starlette](https://github.com/sysid/sse-starlette), [Uvicorn](https://github.com/encode/uvicorn), [httpx-oauth](https://github.com/frankie567/httpx-oauth), [jinja](https://github.com/pallets/jinja), [blinker](https://github.com/pallets-eco/blinker), [pyjwt](https://github.com/jpadilla/pyjwt), [Sentry](https://github.com/getsentry/sentry) + more</sub><br />
<sub>♥️🙏 To our `package.json` friends: [Next.js](https://github.com/vercel/next.js/), [TanStack Query](https://github.com/TanStack/query), [tailwindcss](https://github.com/tailwindlabs/tailwindcss), [zustand](https://github.com/pmndrs/zustand), [openapi-typescript-codegen](https://github.com/ferdikoomen/openapi-typescript-codegen), [axios](https://github.com/axios/axios), [radix-ui](https://github.com/radix-ui/primitives), [cmdk](https://github.com/pacocoursey/cmdk), [framer-motion](https://github.com/framer/motion) + more</sub>


## Security
If you believe you have found a security vulnerability in Polar, we encourage you to responsibly disclose this and not open a public issue. We will investigate all legitimate reports and greatly appreciate your help. Email security@polar.sh to disclose any security vulnerabilities.

## License
Licensed under [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).
