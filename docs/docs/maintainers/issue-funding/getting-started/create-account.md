## Create an account

[Signup as a maintainer](https://polar.sh/signup/maintainer) to speed through
the account creation & app installation flow:

1. Create a Polar account using your GitHub login (OAuth)

    *Your personal account can also be used in the future to fund issues via Polar.*

2. Redirected to the GitHub app installation flow - granting access to select repositories to use with Polar for issue funding (see next step).

![Screenshot of signup page on Polar](/assets/maintainers/issue-funding/signup-light.jpg#only-light)
![Screenshot of signup page on Polar](/assets/maintainers/issue-funding/signup-dark.jpg#only-dark)

**Why we require GitHub login (OAuth)**

- Verify your GitHub account
- Create a matching, public, profile on Polar (avatar, username, bio etc)
- Show your profile in connection with funding issues (optional)
- Install & manage the Polar GitHub app (next step) to enable funding towards
  issues across your select repositories.


???+ question "What GitHub permissions does Polar request for an account?"
    We require read-only access from GitHub to your email address. It's
    required so we can send receipts & funding notifications to you via email.

    We also get read-only access to public GitHub profile resources (default by
    GitHub). Below is what we use:

    - Your public profile. Used to create a matching one on Polar (same username).
    - Your GitHub stars. Used to surface popular issues across them (recommended
      funding - optional)

    **Note:** In addition to a Polar account, maintainers will need to install
    the Polar app for select repositories. Our next section covers this -
    including the repository permissions our app needs.


!!! info "GitHub says Polar can 'Act on my behalf'"
    Unfortunately, this is a default notice - poorly explained - from GitHub in all their OAuth
    authentication flows. [See this ticket from the wider community asking GitHub to improve
    the copy.](https://github.com/orgs/community/discussions/37117b)

    Rest assured, we do not do anything on your behalf without a delibrate action
    performed by you via Polar for an explicit, clear & desired outcome by you.

    Specifically, we make it easy for you - as a maintainer - to comment on issues
    you manage via Polar. In case you want to promote funding or notify
    contributors about granted rewards via an in-line comment. No such comment
    is automated, required or hard-coded (you can edit them freely in our UI) and they
    require you to manually submit them each time.
