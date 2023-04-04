from blinker import Namespace  # type: ignore

signal = Namespace().signal

organization_created = signal("organization.created")
organization_updated = signal("organization.updated")
