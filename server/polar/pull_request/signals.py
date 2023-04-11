from blinker import Namespace

signal = Namespace().signal

pull_request_created = signal("pull_request.created")
pull_request_updated = signal("pull_request.updated")
