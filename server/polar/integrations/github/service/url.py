import re

from polar.integrations.github.schemas import GitHubIssue


class GitHubUrlService:
    # "org/repo#14"
    # "repo#14"
    # "#14"
    org_repo_number_re = re.compile(
        r"(?P<owner>[a-z0-9][a-z0-9-]*)?(?:/(?P<repo>[a-z0-9_\.-]+))?#(?P<number>\d++)(?![a-z])",
        re.IGNORECASE,
    )

    href_re = re.compile(
        r"(?:https?://(?:www\.)?github\.com/)(?P<owner>[a-z0-9][a-z0-9-]*)?(?:/(?P<repo>[a-z0-9_\.-]+))?(?:#|/issues/)(?P<number>\d++)(?![a-z])",
        re.IGNORECASE,
    )

    def parse_urls(self, body: str) -> list[GitHubIssue]:
        """
        given a body of text, parse out the dependencies (i.e. issues in other repos
        that this body references)
        """
        patterns = [
            self.org_repo_number_re,
            self.href_re,
        ]

        dependencies = [
            GitHubIssue(
                raw=m.group(0),
                owner=m.group("owner"),
                repo=m.group("repo"),
                number=int(m.group("number")),
            )
            for pattern in patterns
            for m in pattern.finditer(body)
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
