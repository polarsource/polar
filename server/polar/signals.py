from blinker import signal  # type: ignore[import]

issue_created = signal("issue.created")
issue_updated = signal("issue.updated")
# Specific event for a synced issue during onboarding/installation
issue_synced = signal("issue.synced")

pull_request_created = signal("pull_request.created")
pull_request_updated = signal("pull_request.updated")

organization_created = signal("organization.created")
organization_updated = signal("organization.updated")
