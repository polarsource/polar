from blinker import Namespace  # noqa: F401

signal = Namespace().signal

issue_created = signal("issue.created")
issue_updated = signal("issue.updated")
