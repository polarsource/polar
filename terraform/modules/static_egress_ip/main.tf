resource "aws_eip" "this" {
  domain = "vpc"

  tags = merge(var.tags, { Name = var.name })
}
