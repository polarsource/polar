from blinker import Namespace

signal = Namespace().signal

pledge_created = signal("pledge.created")
pledge_updated = signal("pledge.updated")
