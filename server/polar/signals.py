from blinker import signal  # type: ignore[import]

repository_issue_synced = signal("repository.issue.synced")

issue_created = signal("issue.created")
issue_updated = signal("issue.updated")

pull_request_created = signal("pull_request.created")
pull_request_updated = signal("pull_request.updated")

organization_created = signal("organization.created")
organization_updated = signal("organization.updated")
