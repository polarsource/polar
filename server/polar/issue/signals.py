from blinker import Namespace

signal = Namespace().signal

issue_created = signal("issue.created")
issue_updated = signal("issue.updated")

issue_reference_created = signal("issue_reference.created")
issue_reference_updated = signal("issue_reference.updated")
