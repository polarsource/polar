from blinker import signal  # type: ignore[import]

issue_created = signal("issue.created")
issue_updated = signal("issue.updated")

organization_created = signal("organization.created")
organization_updated = signal("organization.updated")
