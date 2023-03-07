from blinker import Namespace  # type: ignore[import]

signal = Namespace().signal

issue_created = signal("issue.created")
issue_updated = signal("issue.updated")
# Specific event for a synced issue during onboarding/installation
issue_synced = signal("issue.synced")
issue_sync_completed = signal("issue.sync.completed")
