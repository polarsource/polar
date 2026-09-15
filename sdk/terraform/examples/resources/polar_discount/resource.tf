resource "polar_discount" "launch" {
  name     = "Launch discount"
  type     = "percentage"
  duration = "once"

  basis_points = 2000 # 20%
  code         = "LAUNCH20"

  ends_at         = "2026-12-31T23:59:59Z"
  max_redemptions = 100
}
