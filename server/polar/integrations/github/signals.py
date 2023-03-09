from blinker import Namespace  # type: ignore[import]

signal = Namespace().signal

github_issue_created = signal("github.issue.created")
github_issue_updated = signal("github.issue.updated")
