from blinker import Namespace

signal = Namespace().signal

issue_created = signal("issue.created")
issue_updated = signal("issue.updated")
