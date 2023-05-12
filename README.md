<p align="center">
  <a href="https://polar.sh">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/polarsource/polar/assets/281715/279ff15e-c9b1-4db4-9792-a6be0a4c3467">
    <img alt="Polar" src="https://github.com/polarsource/polar/assets/281715/279ff15e-c9b1-4db4-9792-a6be0a4c3467">
    </picture>
  </a>
</p>


<hr />
<div align="center">
  
<a href="https://polar.sh">Website</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<span>Private Alpha - <a href="https://polar.sh/request">Request early access</a></span>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://polar.sh/faq">FAQ</a>



<p align="center">
  <a href="https://github.com/medusajs/medusa/blob/develop/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="Polar is released under the Apache 2.0 license." />
  </a>

  <a href="https://twitter.com/intent/follow?screen_name=medusajs">
    <img src="https://img.shields.io/twitter/follow/polar_sh.svg?label=Follow%20@polar_sh" alt="Follow @polar_sh" />
  </a>
</p>
</div>
<hr />

## Introducing Polar

**Polar is building a platform for open source maintainers to build, operate and grow independent businesses for their initiatives.** Be it full-time or on the side. 

`TODO: Finish this – have to run now`

#### Private Alpha
Currently in Private Alpha. Sending out invites weekly as we build towards a public beta. [Request an invite](https://polar.sh/request).

## Roadmap, Issues & Feature Requests
[Join our discussions](https://github.com/orgs/polarsource/discussions) to help shape the future of Polar and to see what we're working on. We're excited to hear from you!

**🐛 Found a bug?** [Submit it here](https://github.com/polarsource/polar/issues).

**🔓 Found a security vulnerability?** We greatly appreciate responsible and private disclosures to security@polar.sh. See [Security](./README.md#Security)

## Contributions
Documentation on how to setup a development environment is incoming. Until then, if you're feeling adventurous checkout our repository structure below and [clients/README](./clients/README.md) and [server/README](./server/README.md) in particular.

## Monorepo

* **[server](./server/README.md)** – Python / FastAPI / Arq / SQLAlchemy (PostgreSQL) / Redis
* **[clients](./clients/README.md)** – Turborepo
  * [web](./clients/apps/web) (Dashboard) – NextJS (TypeScript)
  * [chrome-extension](./clients/apps/chrome-extension) – React (TypeScript)
  * [polarkit](./clients/packages/polarkit) - Shared React components & API client

<sub>♥️🙏 To our `pyproject.toml` friends: [FastAPI](https://github.com/tiangolo/fastapi), [Pydantic](https://github.com/pydantic/pydantic), [Arq](https://github.com/samuelcolvin/arq), [SQLAlchemy](https://github.com/sqlalchemy/sqlalchemy), [Githubkit](https://github.com/yanyongyu/githubkit), [sse-starlette](https://github.com/sysid/sse-starlette), [Uvicorn](https://github.com/encode/uvicorn), [httpx-oauth](https://github.com/frankie567/httpx-oauth), [jinja](https://github.com/pallets/jinja), [blinker](https://github.com/pallets-eco/blinker), [pyjwt](https://github.com/jpadilla/pyjwt), [Sentry](https://github.com/getsentry/sentry) + more</sub><br />
<sub>♥️🙏 To our `package.json` friends: [Next.js](https://github.com/vercel/next.js/), [TanStack Query](https://github.com/TanStack/query), [tailwindcss](https://github.com/tailwindlabs/tailwindcss), [zustand](https://github.com/pmndrs/zustand), [openapi-typescript-codegen](https://github.com/ferdikoomen/openapi-typescript-codegen), [axios](https://github.com/axios/axios), [radix-ui](https://github.com/radix-ui/primitives), [cmdk](https://github.com/pacocoursey/cmdk), [framer-motion](https://github.com/framer/motion) + more</sub>

## Join the team
[We're hiring](https://polar.sh/careers)!

Our team is based in Stockholm, Sweden today during this founding stage. In the future we intend to go fully remote, and gradually over timezones, but exceptional talent can certainly accelerate our timeline.

## Security
If you believe you have found a security vulnerability in Polar, we encourage you to responsibly disclose this and not open a public issue. We will investigate all legitimate reports and greatly appreciate your help. Email security@polar.sh to disclose any security vulnerabilities.

## License
Licensed under [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).
