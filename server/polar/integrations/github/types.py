from . import client as github


GithubIssue = github.rest.Issue | github.webhooks.IssuesOpenedPropIssue

GithubPullRequestSimple = github.rest.PullRequestSimple
GithubPullRequestFull = (
    github.rest.PullRequest | github.webhooks.PullRequestOpenedPropPullRequest
)

GithubUser = github.rest.PrivateUser | github.rest.PublicUser
