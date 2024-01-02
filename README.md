<p align="center">

  <a href="https://polar.sh">
    <img src="https://github.com/polarsource/polar/assets/281715/4a106e03-bb10-4399-9d72-6ef2af004986" />
  </a>


</p>

<hr />
<div align="center">

<a href="https://polar.sh">Website</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<span>Public Alpha - <a href="https://polar.sh/signup/maintainer">Get started</a></span>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://docs.polar.sh/faq/">FAQ</a>
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

## Polar: Empowering Open Source Maintainers to Become Entrepreneurs
Our goal is to build a platform for open source maintainers to seamlessly set up, operate and scale value-add services and subscriptions to their backers – individuals and businesses alike.

Crafting on-demand and tiered subscription services tailored to suit their initiative, community and their users’ needs. From a suite of offerings such as:
- **Prioritized issues**. What Polar is today with more to come (see below).
- **Backer management & communication**. Automated and streamlined promotions, i.e tiered logos on README/Sites, newsletters, polls etc.
- **Premium support**. Questions, implementation guidance to consultation scheduling etc.
- **Premium access**. Educational material, roadmap voting, early or private access to repositories and packages and more.
- **Custom**. We’ll have a Polar API to enable unlimited creativity for other services you might want to build across your domains and other platforms.

All available in a dashboard designed to make managing these services a delightful experience. In combination with insights and marketing tools to help grow them over time.

[Read more](https://blog.polar.sh/polar-v1-0-lets-fix-open-source-funding/) about our v1.0 goals and our announcement of having raised a $1.8M pre-seed to pursue this vision.

## Polar Public Alpha (v0.1)
  <a href="https://polar.sh">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/polarsource/polar/assets/281715/94db6844-f5db-43db-bb57-78bfb51e8783">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/polarsource/polar/assets/281715/94db6844-f5db-43db-bb57-78bfb51e8783">
    <img alt="Polar" src="https://github.com/polarsource/polar/assets/281715/94db6844-f5db-43db-bb57-78bfb51e8783">
    </picture>
  </a>

Today, Polar gives open source maintainers a better and funded backlog based on what drives the most impact within their community.

For maintainers:
1. **Embedded pledges.** Our GitHub app can automatically embed the Polar badge to get backers to pledge behind specific issues or features. You can enable it for all or select issues.
2. **Better backlog.** Sorted by feedback and pledges. Filters by progress and stage.
3. **Chrome extension.** Bring Polar with you to enhance GitHub Issues.

For backers (maintainers too):
1. **Track dependencies.** Automatic detection of internal references to open source issues
2. **Seamless pledging.** Ability to pledge behind them with a credit-card on file.

## Roadmap, Issues & Feature Requests
[Join our Discord](https://discord.gg/STfRufb32V) or [GitHub Discussions](https://github.com/orgs/polarsource/discussions) to help shape the future of Polar and to see what we're working on. We're excited to hear from you!

**🐛 Found a bug?** [Submit it here](https://github.com/polarsource/polar/issues).

**🔓 Found a security vulnerability?** We greatly appreciate responsible and private disclosures to security@polar.sh. See [Security](./README.md#Security)

## Polar SDK
Build your own integration with Polar using the [Polar SDK](./clients/packages/sdk) - a JavaScript library which exposes a client based on the Polar OpenAPI schema.

## Contributions

You can develop on Polar in GitHub Codespaces. The environment is pre-configured to contain (most) of the tools that you'll need, and will help you to configure the integration between Polar and GitHub (see [.devcontainer/README](./.devcontainer/README.md)). Using an instance with at least 4 cores is recommended.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/polarsource/polar)

You can also develop on Polar locally on your computer, which is the recommended way of working if you want to get into the deep of how Polar works. Documentation on how to setup a development environment is incoming. Until then, if you're feeling adventurous checkout our repository structure below and [clients/README](./clients/README.md) and [server/README](./server/README.md) in particular.

## Monorepo
* **[server](./server/README.md)** – Python / FastAPI / Arq / SQLAlchemy (PostgreSQL) / Redis
* **[clients](./clients/README.md)** – Turborepo
  * [web](./clients/apps/web) (Dashboard) – NextJS (TypeScript)
  * [chrome-extension](./clients/apps/chrome-extension) – React (TypeScript)
  * [polarkit](./clients/packages/polarkit) - Shared React components
  * [SDK](./clients/packages/sdk) - Polar SDK

<sub>♥️🙏 To our `pyproject.toml` friends: [FastAPI](https://github.com/tiangolo/fastapi), [Pydantic](https://github.com/pydantic/pydantic), [Arq](https://github.com/samuelcolvin/arq), [SQLAlchemy](https://github.com/sqlalchemy/sqlalchemy), [Githubkit](https://github.com/yanyongyu/githubkit), [sse-starlette](https://github.com/sysid/sse-starlette), [Uvicorn](https://github.com/encode/uvicorn), [httpx-oauth](https://github.com/frankie567/httpx-oauth), [jinja](https://github.com/pallets/jinja), [blinker](https://github.com/pallets-eco/blinker), [pyjwt](https://github.com/jpadilla/pyjwt), [Sentry](https://github.com/getsentry/sentry) + more</sub><br />
<sub>♥️🙏 To our `package.json` friends: [Next.js](https://github.com/vercel/next.js/), [TanStack Query](https://github.com/TanStack/query), [tailwindcss](https://github.com/tailwindlabs/tailwindcss), [zustand](https://github.com/pmndrs/zustand), [openapi-typescript-codegen](https://github.com/ferdikoomen/openapi-typescript-codegen), [axios](https://github.com/axios/axios), [radix-ui](https://github.com/radix-ui/primitives), [cmdk](https://github.com/pacocoursey/cmdk), [framer-motion](https://github.com/framer/motion) + more</sub>


## Security
If you believe you have found a security vulnerability in Polar, we encourage you to responsibly disclose this and not open a public issue. We will investigate all legitimate reports and greatly appreciate your help. Email security@polar.sh to disclose any security vulnerabilities.

## License
Licensed under [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).
