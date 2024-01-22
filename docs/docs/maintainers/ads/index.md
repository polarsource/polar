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

