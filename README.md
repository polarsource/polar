<p align="center">

  <a href="https://polar.sh">
      <img src="https://github.com/user-attachments/assets/89a588e5-0c58-429a-8bbe-20f70af41372" />
  </a>

</p>

<div align="center">

<a href="https://www.producthunt.com/posts/polar-5?embed=true&utm_source=badge-top-post-badge&utm_medium=badge&utm_souce=badge-polar&#0045;5" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=484271&theme=dark&period=daily" alt="Polar - An&#0032;open&#0032;source&#0032;monetization&#0032;platform&#0032;for&#0032;developers | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a> <a href="https://www.producthunt.com/posts/polar-5?embed=true&utm_source=badge-top-post-topic-badge&utm_medium=badge&utm_souce=badge-polar&#0045;5" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-topic-badge.svg?post_id=484271&theme=dark&period=monthly&topic_id=267" alt="Polar - An&#0032;open&#0032;source&#0032;monetization&#0032;platform&#0032;for&#0032;developers | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

</div>

<hr />
<div align="center">

<a href="https://polar.sh">Website</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://polar.sh/blog">Blog</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://polar.sh/docs">Docs</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://polar.sh/docs/api-reference">API Reference</a>

<p align="center">
  <a href="https://discord.gg/Pnhfz3UThd">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>

  <a href="https://twitter.com/intent/follow?screen_name=polar_sh">
    <img src="https://img.shields.io/twitter/follow/polar_sh.svg?label=Follow%20@polar_sh" alt="Follow @polar_sh" />
  </a>
</p>
</div>
<hr />

## Polar: Open Source payments infrastructure for the 21st century

Focus on building your passion, while we focus on the infrastructure to get you paid.

- Sell SaaS and digital products in minutes
- All-in-one funding & monetization platform for developers.
- Sell access to GitHub repositories, Discord Support channels, File Downloads, License Keys & much more with Digital Products & Subscriptions.
- We're the merchant of record handling the...
    - ...boilerplate (billing, receipts, customer accounts etc)
    - ...headaches (sales tax, VAT)

## Pricing

- 4% + 40¢
- No fixed monthly costs
- Additional fees may apply. [Read more](https://polar.sh/docs/documentation/polar-as-merchant-of-record/fees)

## Roadmap, Issues & Feature Requests

**🎯 Upcoming milestones.** [Check out what we're building towards](https://github.com/polarsource/polar/issues/3242)

**💬 Shape the future of Polar with us.** [Join our Discord](https://discord.gg/Pnhfz3UThd)

**🐛 Found a bug?** [Submit it here](https://github.com/polarsource/polar/issues)

**🔓 Found a security vulnerability?** We greatly appreciate responsible and private disclosures. See [Security](./SECURITY.md)

### Polar API & SDK

You can integrate Polar on your docs, sites or services using our [Public API](https://polar.sh/docs/api-reference) and [Webhook API](https://polar.sh/docs/integrate/webhooks/endpoints).

We also maintain SDKs for the following languages:

- JavaScript (Node.js and browsers): [polarsource/polar-js](https://github.com/polarsource/polar-js)
- Python: [polarsource/polar-python](https://github.com/polarsource/polar-python)

## Contributions

Our [`DEVELOPMENT.md`](./DEVELOPMENT.md) file contains everything you need to know to configure your development environment.

> [!TIP]
> Want to get started quickly? Use GitHub Codespaces.
>
> [![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/polarsource/polar?machine=standardLinux32gb)

### Contributors

<a href="https://github.com/polarsource/polar/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=polarsource/polar" />
</a>

## Monorepo

- **[server](./server/README.md)** – Python / FastAPI / Dramatiq / SQLAlchemy (PostgreSQL) / Redis
- **[clients](./clients/README.md)** – Turborepo
    - [web](./clients/apps/web) (Dashboard) – NextJS (TypeScript)
    - [polarkit](./clients/packages/polarkit) - Shared React components

<sub>♥️🙏 To our `pyproject.toml` friends: [FastAPI](https://github.com/tiangolo/fastapi), [Pydantic](https://github.com/pydantic/pydantic), [Dramatiq](https://github.com/Bogdanp/dramatiq), [SQLAlchemy](https://github.com/sqlalchemy/sqlalchemy), [Githubkit](https://github.com/yanyongyu/githubkit), [sse-starlette](https://github.com/sysid/sse-starlette), [Uvicorn](https://github.com/encode/uvicorn), [httpx-oauth](https://github.com/frankie567/httpx-oauth), [jinja](https://github.com/pallets/jinja), [blinker](https://github.com/pallets-eco/blinker), [pyjwt](https://github.com/jpadilla/pyjwt), [Sentry](https://github.com/getsentry/sentry) + more</sub><br />
<sub>♥️🙏 To our `package.json` friends: [Next.js](https://github.com/vercel/next.js/), [TanStack Query](https://github.com/TanStack/query), [tailwindcss](https://github.com/tailwindlabs/tailwindcss), [openapi-typescript-codegen](https://github.com/ferdikoomen/openapi-typescript-codegen), [axios](https://github.com/axios/axios), [radix-ui](https://github.com/radix-ui/primitives), [cmdk](https://github.com/pacocoursey/cmdk), [framer-motion](https://github.com/framer/motion) + more</sub><br />
<sub>♥️🙏 To [IPinfo](https://ipinfo.io) that provides IP address data to help us geolocate customers during checkout.</sub>

## License

Licensed under [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).
