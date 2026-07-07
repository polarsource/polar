from polar.v2026_04 import Polar

polar = Polar("https://api.polar.com", "ACCESS_TOKEN")
customer = polar.customers.get("ID")  # Type-safe versioned customer object
