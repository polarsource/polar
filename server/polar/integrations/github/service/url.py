import re

from polar.integrations.github.schemas import GitHubIssue


class GitHubUrlService:
    issue_re = re.compile(
        r"(?P<owner>[a-z0-9][a-z0-9-]*)?(?:/(?P<repo>[a-z0-9_\.-]+))?#(?P<number>\d+)|(?:https?://(?:www\.)?github\.com/)?(?P<owner2>[a-z0-9][a-z0-9-]*)?(?:/(?P<repo2>[a-z0-9_\.-]+))?(?:#|/issues/)(?P<number2>\d+)",
        re.IGNORECASE,
    )

    def parse_urls(self, body: str) -> list[GitHubIssue]:
        """
        given a body of text, parse out the dependencies (i.e. issues in other repos
        that this body references)
        """
        dependencies = [
            GitHubIssue(
                raw=m.group(0),
                owner=m.group("owner") or m.group("owner2"),
                repo=m.group("repo") or m.group("repo2"),
                number=int(m.group("number") or m.group("number2")),
            )
            for m in self.issue_re.finditer(body)
        ]

        # Deduplicate the dependencies
        seen_dependencies = set()
        ret = []
        for dependency in dependencies:
            if dependency.canonical in seen_dependencies:
                continue
            seen_dependencies.add(dependency.canonical)
            ret.append(dependency)

        return ret

github_url = GitHubUrlService()
