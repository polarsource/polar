from blinker import Namespace

signal = Namespace().signal

organization_created = signal("organization.created")
organization_updated = signal("organization.updated")
