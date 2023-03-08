from blinker import Namespace  # type: ignore[import]

signal = Namespace().signal

issue_created = signal("issue.created")
issue_updated = signal("issue.updated")
