from polar.integrations.github.schemas import GitHubIssue
from polar.integrations.github.service.url import github_url


def test_parse_urls() -> None:
    assert github_url.parse_urls("#123") == [GitHubIssue(raw="#123", number=123)]
    assert github_url.parse_urls("#123b") == []
    assert github_url.parse_urls("**#123**") == [GitHubIssue(raw="#123", number=123)]
    assert github_url.parse_urls("#123/4") == [GitHubIssue(raw="#123", number=123)]

    assert github_url.parse_urls("hello # world") == []
    assert github_url.parse_urls("hello #1 world") == [GitHubIssue(raw="#1", number=1)]

    assert github_url.parse_urls("org/repo#14") == [
        GitHubIssue(raw="org/repo#14", owner="org", repo="repo", number=14)
    ]

    assert github_url.parse_urls("org/repo#14f") == []

    assert github_url.parse_urls("https://www.github.com/org/repo/issues/17423") == [
        GitHubIssue(
            raw="https://www.github.com/org/repo/issues/17423",
            owner="org",
            repo="repo",
            number=17423,
        )
    ]
    assert github_url.parse_urls("http://github.com/org/repo/issues/897764") == [
        GitHubIssue(
            raw="http://github.com/org/repo/issues/897764",
            owner="org",
            repo="repo",
            number=897764,
        )
    ]

    assert github_url.parse_urls(
        "wow at http://github.com/org/repo/issues/897764 hello"
    ) == [
        GitHubIssue(
            raw="http://github.com/org/repo/issues/897764",
            owner="org",
            repo="repo",
            number=897764,
        )
    ]

    assert github_url.parse_urls(
        "wow at **http://github.com/org/repo/issues/897764** hello"
    ) == [
        GitHubIssue(
            raw="http://github.com/org/repo/issues/897764",
            owner="org",
            repo="repo",
            number=897764,
        )
    ]

    assert (
        github_url.parse_urls("wow at http://github.com/org/repo/issues/897764hello")
        == []
    )

    assert github_url.parse_urls(
        """
    Bumps [k8s.io/api](https://github.com/kubernetes/api) from 0.26.1 to 0.26.2.
    <details>
    <summary>Commits</summary>
    <ul>
    <li><a href=\"https://github.com/kubernetes/api/commit/1528256abbdf8ff2510112b28a6aacd239789a36\"><code>1528256</code></a> Update dependencies to v0.26.2 tag</li>
    <li><a href=\"https://github.com/kubernetes/api/commit/5fd8a44fa3de0b961724fc8eba81e49da15fc419\"><code>5fd8a44</code></a> Merge pull request <a href=\"https://github-redirect.dependabot.com/kubernetes/api/issues/115787\">#115787</a> from liggitt/net-0.7.0-1.26</li>
    <li><a href=\"https://github.com/kubernetes/api/commit/1b65b647508e917febfc9d331d052fa1c7ab6fab\"><code>1b65b64</code></a> Update golang.org/x/net to v0.7.0</li>
    <li><a href=\"https://github.com/kubernetes/api/commit/2e857c1304ddf31a32f5f26fee1265ede5cb464d\"><code>2e857c1</code></a> Merge pull request <a href=\"https://github-redirect.dependabot.com/kubernetes/api/issues/115400\">#115400</a><code>pohly/automated-cherry-pick-of-#115354</code></li>
    <li><a href=\"https://github.com/kubernetes/api/commit/1c6bd7031bcf0a53d59e88959eba9a00776dceaf\"><code>1c6bd70</code></a> Merge pull request <a href=\"https://github-redirect.dependabot.com/kubernetes/api/issues/115642\">#115642</a> from nckturner/pin-golang.org/x/net-to-v0.4.0-in-1.26</li>
    <li><a href=\"https://github.com/kubernetes/api/commit/045c7fe9c9f1dd68d96c8a3b6380f830fed4c78f\"><code>045c7fe</code></a> Pin golang.org/x/net to v0.4.0 in 1.26</li>
    <li><a href=\"https://github.com/kubernetes/api/commit/50d0b4295d19a4280763a5deec8bf37d36045f3f\"><code>50d0b42</code></a> dynamic resource allocation: avoid apiserver complaint about list content</li>
    <li>See full diff in <a href=\"https://github.com/kubernetes/api/compare/v0.26.1...v0.26.2\">compare view</a></li>
    </ul>
    </details>
    <br />
    [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=k8s.io/api&package-manager=go_modules&previous-version=0.26.1&new-version=0.26.2)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)
    Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.
    [//]: # (dependabot-automerge-start)
    [//]: # (dependabot-automerge-end)
    ---
    <details>
    <summary>Dependabot commands and options</summary>
    <br />
    You can trigger Dependabot actions by commenting on this PR:
    - `@dependabot rebase` will rebase this PR
    - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it
    - `@dependabot merge` will merge this PR after your CI passes on it
    - `@dependabot squash and merge` will squash and merge this PR after your CI passes on it
    - `@dependabot cancel merge` will cancel a previously requested merge and block automerging
    - `@dependabot reopen` will reopen this PR if it is closed
    - `@dependabot close` will close this PR and stop Dependabot recreating it. You can achieve the same result by closing it manually
    - `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself)
    - `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself)
    - `@dependabot ignore this dependency` will close this PR and stop Dependabot creating any more for this dependency (unless you reopen the PR or upgrade to it yourself)
    </details>"""
    ) == [
        GitHubIssue(raw="#115787", owner=None, repo=None, number=115787),
        GitHubIssue(raw="#115400", owner=None, repo=None, number=115400),
        GitHubIssue(
            raw="pohly/automated-cherry-pick-of-#115354",
            owner="pohly",
            repo="automated-cherry-pick-of-",
            number=115354,
        ),
        GitHubIssue(raw="#115642", owner=None, repo=None, number=115642),
    ]


def test_parse_multiple_urls() -> None:
    assert github_url.parse_urls("#123 #456") == [
        GitHubIssue(raw="#123", number=123),
        GitHubIssue(raw="#456", number=456),
    ]

    assert github_url.parse_urls("Some text #7 some more text #5653 and some more") == [
        GitHubIssue(raw="#7", number=7),
        GitHubIssue(raw="#5653", number=5653),
    ]


def test_parse_unique_urls() -> None:
    assert github_url.parse_urls("#123 #123") == [GitHubIssue(raw="#123", number=123)]
    assert github_url.parse_urls(
        "Some text #7 some more text #5653 and some more #7"
    ) == [
        GitHubIssue(raw="#7", number=7),
        GitHubIssue(raw="#5653", number=5653),
    ]


def test_other_domains() -> None:
    assert github_url.parse_urls("https://www.example.org/org/repo/issues/17423") == []
    assert (
        github_url.parse_urls(
            "https://gitlab.com/XXX/YYYY/-/commit/ZZZZZZZZZ#FFFFF_123_321"
        )
        == []
    )

    assert (
        github_url.parse_urls(
            """
    [hello](https://gitlab.com/abc/abc/-/commit/deadbeef#6d123_452) nice
    """
        )
        == []
    )
