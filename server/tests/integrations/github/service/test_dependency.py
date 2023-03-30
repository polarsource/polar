from polar.integrations.github.schemas import GithubIssueDependency
from polar.integrations.github.service.dependency import github_dependency


def test_parse_dependency() -> None:
    assert github_dependency.parse_dependencies("#123") == [
        GithubIssueDependency(raw="#123", number=123)
    ]
    assert github_dependency.parse_dependencies("org/repo#14") == [
        GithubIssueDependency(raw="org/repo#14", owner="org", repo="repo", number=14)
    ]
    assert github_dependency.parse_dependencies(
        "https://www.github.com/org/repo/issues/17423"
    ) == [
        GithubIssueDependency(
            raw="https://www.github.com/org/repo/issues/17423",
            owner="org",
            repo="repo",
            number=17423,
        )
    ]
    assert github_dependency.parse_dependencies(
        "http://github.com/org/repo/issues/897764"
    ) == [
        GithubIssueDependency(
            raw="http://github.com/org/repo/issues/897764",
            owner="org",
            repo="repo",
            number=897764,
        )
    ]


def test_parse_multiple_dependencies() -> None:
    assert github_dependency.parse_dependencies("#123 #456") == [
        GithubIssueDependency(raw="#123", number=123),
        GithubIssueDependency(raw="#456", number=456),
    ]

    assert github_dependency.parse_dependencies(
        "Some text #7 some more text #5653 and some more"
    ) == [
        GithubIssueDependency(raw="#7", number=7),
        GithubIssueDependency(raw="#5653", number=5653),
    ]


def test_parse_unique_dependencies() -> None:
    assert github_dependency.parse_dependencies("#123 #123") == [
        GithubIssueDependency(raw="#123", number=123)
    ]
    assert github_dependency.parse_dependencies(
        "Some text #7 some more text #5653 and some more #7"
    ) == [
        GithubIssueDependency(raw="#7", number=7),
        GithubIssueDependency(raw="#5653", number=5653),
    ]
