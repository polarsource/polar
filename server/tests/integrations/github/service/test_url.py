from polar.integrations.github.schemas import GitHubIssue
from polar.integrations.github.service.url import github_url


def test_parse_urls() -> None:
    assert github_url.parse_urls("#123") == [
        GitHubIssue(raw="#123", number=123)
    ]
    assert github_url.parse_urls("org/repo#14") == [
        GitHubIssue(raw="org/repo#14", owner="org", repo="repo", number=14)
    ]
    assert github_url.parse_urls(
        "https://www.github.com/org/repo/issues/17423"
    ) == [
        GitHubIssue(
            raw="https://www.github.com/org/repo/issues/17423",
            owner="org",
            repo="repo",
            number=17423,
        )
    ]
    assert github_url.parse_urls(
        "http://github.com/org/repo/issues/897764"
    ) == [
        GitHubIssue(
            raw="http://github.com/org/repo/issues/897764",
            owner="org",
            repo="repo",
            number=897764,
        )
    ]


def test_parse_multiple_urls() -> None:
    assert github_url.parse_urls("#123 #456") == [
        GitHubIssue(raw="#123", number=123),
        GitHubIssue(raw="#456", number=456),
    ]

    assert github_url.parse_urls(
        "Some text #7 some more text #5653 and some more"
    ) == [
        GitHubIssue(raw="#7", number=7),
        GitHubIssue(raw="#5653", number=5653),
    ]


def test_parse_unique_urls() -> None:
    assert github_url.parse_urls("#123 #123") == [
        GitHubIssue(raw="#123", number=123)
    ]
    assert github_url.parse_urls(
        "Some text #7 some more text #5653 and some more #7"
    ) == [
        GitHubIssue(raw="#7", number=7),
        GitHubIssue(raw="#5653", number=5653),
    ]

def test_other_domains() -> None:
    assert github_url.parse_urls("https://www.example.org/org/repo/issues/17423") == []
