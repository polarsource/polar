<p align="center">

  <a href="https://polar.sh">
      <img src="https://github.com/polarsource/polar/blob/main/clients/apps/web/public/assets/brand/polar_og.jpg?raw=true" />
  </a>


</p>

<hr />
<div align="center">

<a href="https://polar.sh/polarsource">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://polar.sh/embed/subscribe.svg?org=polarsource&label=Subscribe&darkmode">
      <img alt="Subscribe on Polar" src="https://polar.sh/embed/subscribe.svg?org=polarsource&label=Subscribe">
    </picture>
</a>

<a href="https://polar.sh">Sign Up</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://polar.sh/polarsource">Blog</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://polar.sh/docs">Docs</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://polar.sh/docs/api">API</a>


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

## Polar.sh: All-in-one funding & monetization platform for developers
Focus on building your passion, while we focus on the infrastructure to get you paid.

- All-in-one funding & monetization platform for open source- and indie developers.
- Sell access to GitHub repositories, Discord Support channels, File Downloads, License Keys & much more with Digital Products & Subscriptions.
- Setup crowdfunding on your GitHub issues
- We're the merchant of record handling the...
  - ...boilerplate (billing, receipts, customer accounts etc)
  - ...headaches (sales tax, VAT)

## Pricing

- No fixed, monthly, costs
- 5% + payment & payout fees

## Roadmap, Issues & Feature Requests
**🎯 v1.0 North Star.** [Checkout what we're building towards](https://github.com/polarsource/polar/issues/3242)

**💬 Shape the future of Polar with us.** [Join our Discord](https://discord.gg/STfRufb32V)

**🐛 Found a bug?** [Submit it here](https://github.com/polarsource/polar/issues).

**🔓 Found a security vulnerability?** We greatly appreciate responsible and private disclosures to security@polar.sh. See [Security](./README.md#Security)

### Polar API & SDK
You can integrate Polar on your docs, sites or services using our [Public API](https://polar.sh/docs/api), [Webhook API](https://api.polar.sh/docs#/webhooks), and/or our [Polar JS SDK](./clients/packages/sdk) (Beta)


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
  * [polarkit](./clients/packages/polarkit) - Shared React components
  * [`@polar-sh/sdk`](./clients/packages/sdk) - Polar JS SDK
  * [`@polar-sh/astro`](./clients/packages/astro) - Polar Astro SDK
  * [astro-example](./clients/examples/astro-example) - Astro Example app powered by `@polar-sh/astro`

<sub>♥️🙏 To our `pyproject.toml` friends: [FastAPI](https://github.com/tiangolo/fastapi), [Pydantic](https://github.com/pydantic/pydantic), [Arq](https://github.com/samuelcolvin/arq), [SQLAlchemy](https://github.com/sqlalchemy/sqlalchemy), [Githubkit](https://github.com/yanyongyu/githubkit), [sse-starlette](https://github.com/sysid/sse-starlette), [Uvicorn](https://github.com/encode/uvicorn), [httpx-oauth](https://github.com/frankie567/httpx-oauth), [jinja](https://github.com/pallets/jinja), [blinker](https://github.com/pallets-eco/blinker), [pyjwt](https://github.com/jpadilla/pyjwt), [Sentry](https://github.com/getsentry/sentry) + more</sub><br />
<sub>♥️🙏 To our `package.json` friends: [Next.js](https://github.com/vercel/next.js/), [TanStack Query](https://github.com/TanStack/query), [tailwindcss](https://github.com/tailwindlabs/tailwindcss), [zustand](https://github.com/pmndrs/zustand), [openapi-typescript-codegen](https://github.com/ferdikoomen/openapi-typescript-codegen), [axios](https://github.com/axios/axios), [radix-ui](https://github.com/radix-ui/primitives), [cmdk](https://github.com/pacocoursey/cmdk), [framer-motion](https://github.com/framer/motion) + more</sub>


## Security
If you believe you have found a security vulnerability in Polar, we encourage you to responsibly disclose this and not open a public issue. We will investigate all legitimate reports and greatly appreciate your help. Email security@polar.sh to disclose any security vulnerabilities.

## License
Licensed under [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).
