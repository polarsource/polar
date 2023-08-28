# GitHub Action

> This page is a live demo of how Polar can be integrated into your documentation or blog using the Polar API.

You can integrate Polar using the [Polar GitHub Action](https://github.com/polarsource/actions) or by using the [Polar API](https://api.polar.sh/redoc) directly.


The [Polar GitHub Action](https://github.com/polarsource/actions) is an GitHub Action (and standalone Python script) that you can add to your statically built websites build step or run regularly.

The action works by searching for HTML comments in the HTML or Markdown and replacing it with rendered data.

It can look like this: <code>&lt;!-- POLAR type=issues org=polarsource repo=polar limit=3 --&gt;</code> which will be replaced by a list of the top 3 issues from polarsource/polar.

In this case, it will be replaced by this block:

```md
<!-- POLAR type=issues id=dzaalrfj org=polarsource repo=polar limit=3 -->

* [#897 v0.5 Roadmap: OSS Sponsorship 2.0 – $20.0 💰](https://github.com/polarsource/polar/issues/897)
* [#873 Can't use `redis 4.6.0` without connection pool leakage in worker](https://github.com/polarsource/polar/issues/873)
* [#225 Integrate Stripe Revenue Recognition](https://github.com/polarsource/polar/issues/225)

<!-- POLAR-END id=dzaalrfj -->
```

On subsequent executions the contents between the `POLAR` and `POLAR-END` tags will be replaced. The `id` is automatically generated and needs to be unique within a single document. It's used to help knowing where each section starts and ends.

## type=issues

The (currently only) type is `issues` which renders issues and their current pledged amount as a list.

### Arguments

* `org` **(required)** – Organization to list issues from
* `repo` _(optional)_ – Repository to list issues from
* `limit` _(optional)_ – Defaults to 5
* `sort_by` _(optional)_ - Defaults to "funding_goal_desc_and_most_positive_reactions" – [Read more](https://api.polar.sh/redoc#tag/issues/operation/issues:search)


### Example

<code>&lt;!-- POLAR type=issues org=polarsource repo=polar limit=3 --&gt;</code>

```md
<!-- POLAR type=issues id=dzaalrfj org=polarsource repo=polar limit=3 -->

* [#897 v0.5 Roadmap: OSS Sponsorship 2.0 – $20.0 💰](https://github.com/polarsource/polar/issues/897)
* [#873 Can't use `redis 4.6.0` without connection pool leakage in worker](https://github.com/polarsource/polar/issues/873)
* [#225 Integrate Stripe Revenue Recognition](https://github.com/polarsource/polar/issues/225)

<!-- POLAR-END id=dzaalrfj -->
```

Rendered 👇

<!-- POLAR type=issues id=dzaalrfj org=polarsource repo=polar limit=3 -->

* [#897 v0.5 Roadmap: OSS Sponsorship 2.0 – $20.0 💰](https://github.com/polarsource/polar/issues/897)
* [#873 Can't use `redis 4.6.0` without connection pool leakage in worker](https://github.com/polarsource/polar/issues/873)
* [#225 Integrate Stripe Revenue Recognition](https://github.com/polarsource/polar/issues/225)

<!-- POLAR-END id=dzaalrfj -->
