---
title: Install GitHub App | Maintainers
---

# Install the Polar GitHub App

Amazing, you now have an account setup and have been redirected to install the
Polar App on GitHub by either:

- [Signing up as a new maintainer on Polar](/maintainers/issue-funding/getting-started/setup-account/#creating-a-new-account)
- [Enabling maintainer mode for an existing account](/maintainers/issue-funding/getting-started/setup-account/#enable-personal-maintainer-account)
- Or, perhaps you're in the process of [connecting an additional GitHub
  organization](/maintainers/issue-funding/getting-started/setup-account/#connect-github-organization) to use with Polar

All roads lead to Rome, or in our case the GitHub App installation flow for the
Polar app.

## GitHub's Installation Flow

1. **Choose account or organization:** GitHub will ask you to choose which
   account or organization to install Polar for in case you have access to more
   than one.
2. **Review & Install Polar App:** For selected repositories under the chosen
   GitHub account or organization. *See below.*

![Polar App Installation at GitHub](../../../../assets/maintainers/issue-funding/gh-app-install-light.jpg#only-light)
![Polar App Installation at GitHub](../../../../assets/maintainers/issue-funding/gh-app-install-dark.jpg#only-dark)

### Choosing repositories

Choose which repositories Polar should have access to. Access is required to
easily embed the Polar funding badge on issues. However, you're always in
control of which issues to badge across the repositories you've granted access
to.

#### All Repositories

- Every, single, repository is synced with Polar - including future ones
- **Pros:** Automatically use Polar freely across your repositories now and in
  the future.
- **Cons:** You sync a lot and more than might be needed or desired.

!!! info "Private repositories & forks are synced too"
    We sync all the repositories given during installation. Including private
    repos & forks.

    However, we don't expose issues related to private repos except to those who
    can access it on GitHub. It's supported to allow maintainers to connect
    private repositories to try Polar with.

    We also sync forks currently. Supporting cases where forks have superseded
    the original within the community.

    Both of the above are likely to be deprecated features in the future.

#### Select Repositories

- You choose *exactly* which repositories Polar should have access to
- **Pros:** Complete control. Gradual expansion. Great starting point.
- **Cons:** You need to manually add repositories.

!!! question "Can I change repositories later?"
    Of course, you can always change repository access at any point in your GitHub
    settings for the Polar app.


### Required permissions

**Read access to metadata**

We store this data to create a trustworthy user experience for your backers.
Showing repository context on the issue pledge page for backers as an example,
e.g avatar, name, description, stars, license etc.

**Read access to issues & pull requests**

We synchronize all your issues and pull requests in order to deliver our core
offering. Keeping track of all issues, their contributions and current status -
updating it in near real-time (webhooks). Enabling funding to seamlessly work
within your existing workflow & across Polar services.

**Write access to issues & pull requests**

Polar funding is designed to be deeply integrated within the GitHub workflow &
experience. By enabling you to easily embed the beautiful and non-intrusive
Polar funding badge directly within selected issues (at the bottom of their
description). We need to be able to write to issues in order to achieve this. Of
course, we only embed the badge based on your settings and desired issues to
badge.


### Next Step

Welcome onboard - we're excited to support you here at Polar! It's time to [customize the Polar
Badge](/maintainers/issue-funding/getting-started/badge-settings) and start
embedding & promoting it.
