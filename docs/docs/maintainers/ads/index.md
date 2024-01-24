---
title: Advertisements
---

See how you can sell ads ("logo in README") to your subscribers.

---

### Create a ads benefit

![Create an ad benefit](../../assets/maintainers/ads/create-benefit-dark.png#only-dark)
![Create an ad benefit](../../assets/maintainers/ads/create-benefit-light.png#only-light)

To offer ads as a benefit to your subscribers. Go to "Subscriptions" > "Benefits" and click the plus icon to create a new benefit.

As the type, select "Ad". You can sustomize the benefit decsription, and the image width and height of your ad space.




When you've created the benefit, go to your subscription tiers and add the benefit to the relevant tiers.


### Configuring your ad


![Configure ad](../../assets/maintainers/ads/configure-ad-dark.png#only-dark)
![Configure ad](../../assets/maintainers/ads/configure-ad-light.png#only-light)


Subscribers to your ads tier can manage their own ad content from the Benefits page.

From there, the subscriber can upload their images (in light and dark mode! 😎), and configure the text and link.

### Adding ads to your README

You can automatically ad/update/remove ads in your README with the [Polar GitHub Action](https://github.com/polarsource/actions) ([Live Example](https://github.com/zegl/polar-ads-demo)).

The action will replace the HTML comment with HTML/markdown and keep it up to date. The example below runs every hour, and automatically commits and pushes the results to the main branch. You can customize the GitHub Action to send you a Pull Request with updated content if you prefer.

The action works with both markdown content such as READMEs and other HTML content for statically generated blogs and websites.


1. Add the following snippet to your README (or any other file) where you want the ads to be added.

    You can get the `subscription_benefit_id` from the subscription benefits page.

    ```
    <!-- POLAR type=ads subscription_benefit_id=YOUR_BENEFIT_ID width=100 height=100 -->
    ```

2. Create a GitHub Action workflow with the following contents.

    Feel free to modify it to your own needs.

    ```yaml
    name: Polarify

    # Example action of how to use the polarsource/actions/polarify action and auto-commiting the results to the repository.

    on:
    # Run after every push
    push:
        branches: ["main"]

    # Hourly
    schedule:
        - cron: "0 * * * *"

    # Allow to trigger manually from the GitHub Actions Web UI
    workflow_dispatch: {}

    jobs:
    polarify:
        name: "Polarify"
        timeout-minutes: 15
        runs-on: ubuntu-22.04

        permissions:
        # Give the default GITHUB_TOKEN write permission to commit and push the changed files back to the repository.
        contents: write

        steps:
        - name: Check out code
            uses: actions/checkout@v3

        - name: Polarify
            uses: polarsource/actions/polarify@main
            with:
            path: "README.md"
            env:
            POLAR_API_TOKEN: {{ '${{ secrets.POLAR_API_TOKEN }}' }}

        - uses: stefanzweifel/git-auto-commit-action@v4
            with:
            commit_message: Update polar comments
            branch: main
    ```

### Adding ads to _anything_

You can also integrate ads via the [Polar API](../../api), and consume it from anywhere. Like a webserver, or a build step for your website.

```bash
curl -s -H "Authorization: Bearer YOUR_TOKEN_HERE" \
    "https://api.polar.sh/api/v1/advertisements/campaigns/search?organization_name=YOUR_GITHUB_USERNAME_HERE&platform=github&subscription_benefit_id=YOUR_BENEFIT_ID_HERE"
```

_Example response_

```json
{
  "items": [
    {
      "id": "b13e9e4b-cbad-4c27-b421-e4993a984a5c",
      "subscription_id": "44df54b2-05e7-4884-8b13-637036c21c41",
      "subscription_benefit_id": "4da75f02-1507-43dc-9167-10adfa4fb6b2",
      "views": 30,
      "clicks": 0,
      "image_url": "https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/Logotype_blue_small-Bo8grIZgHSOMQk3BnwmoT5Sds6tE7N.png",
      "image_url_dark": null,
      "text": "Join Polar now!",
      "link_url": "https://polar.sh/"
    },
    {
      "id": "94c1676c-db08-4489-b4b4-e25beadf2542",
      "subscription_id": "922bcc1d-b570-42a6-be16-52c868b81576",
      "subscription_benefit_id": "4da75f02-1507-43dc-9167-10adfa4fb6b2",
      "views": 12,
      "clicks": 0,
      "image_url": "https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/Frame%203-lOg2u5gntqF3RuL3cso7Upg9w03dbT.png",
      "image_url_dark": "https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/Frame%202-fcOO2r4HRJSRYthVDEK1Tf4ZTajDN1.png",
      "text": "Hello world!",
      "link_url": "https://polar.sh/zegl"
    }
  ],
  "pagination": {
    "total_count": 2,
    "max_page": 1
  }
}
```