---
title: Promote Funding | Maintainers
---

# Promote Funding

Below are our recommendations of how you can promote your usage of Polar and the
ability for your community to fund impactful efforts.

Organic & contextual promotion via the Polar Badge on issues is fantastic, but
the most successful maintainers have also promoted it proactively using the
tactics below.

## Issue Funding Badge

Just a sanity check: You've embedded the Polar Badge across your issues, right? 😉

## Repository Embeds

We offer a few ways to promote issue funding on your repositories main page.
It's a great place for organic promotion given the higher traffic volume.

![Polar GitHub README Embeds](../../../../assets/maintainers/issue-funding/polar-embeds-light.jpg#only-light)
![Polar GitHub README Embeds](../../../../assets/maintainers/issue-funding/polar-embeds-dark.jpg#only-dark)

### GitHub Sponsorship

You should add your public Polar page as a link under ways to `Sponsor this
project` on GitHub. You can easily do this by adding/modifying a `FUNDING.yml`
file in your repository's `.github` directory (default branch).

1. Checkout the [documentation on FUNDING.yml](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository)
2. Add a new line to `FUNDING.yml` with:

```yml
custom: ["https://polar.sh/{your-username/orgname}"]
```

### Readme Shield

Shields are lovely so Polar offers one of course 😍

<a href="https://polar.sh/polarsource"><img src="https://polar.sh/embed/seeks-funding-shield.svg?org=polarsource" /></a>

```md
<a href="https://polar.sh/{your-username/orgname}"><img src="https://polar.sh/embed/seeks-funding-shield.svg?org={your-username/orgname}" /></a>
```


### Readme: Fundable Issues SVG

We also offer an embeddable SVG highlighting top issues for funding - sorted by
reactions and funding. A great way to promote specific funding within your
`README.md`.

<a href="https://polar.sh/polarsource"><img src="https://polar.sh/embed/fund-our-backlog.svg?org=polarsource" /></a>

```md
<a href="https://polar.sh/{your-username/orgname}"><img src="https://polar.sh/embed/fund-our-backlog.svg?org={your-username/orgname}" /></a>
```


## Your own documentation or blog

Checkout our own [GitHub Action](/api/github-action) which makes it super
easy to integrate Polar and your fundable issues on your blog or in your
documentation.

You could also use our [API](/api) directly to build your own integrations.

## Social

Share your Polar page on your Mastodon, X/Twitter, Discord, Reddit or wherever
your community is. You can also share links to the pledge page for specific
issues.

We generate OG images that are relevant and more focused on funding vs. direct
GitHub links to the issue.
