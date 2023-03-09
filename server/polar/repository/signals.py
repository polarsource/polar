from blinker import Namespace  # type: ignore[import]

signal = Namespace().signal

# Specific event for a synced issue during onboarding/installation
repository_issue_synced = signal("issue.synced")
repository_issues_sync_completed = signal("issue.sync.completed")

repository_pull_request_synced = signal("pull_request.synced")
repository_pull_requests_sync_completed = signal("pull_request.synced")
