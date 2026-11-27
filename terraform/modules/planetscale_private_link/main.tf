locals {
  ingress = {
    for pair in setproduct(range(length(var.client_security_group_ids)), [5432, 6432]) : "${pair[0]}-${pair[1]}" => {
      security_group_id = var.client_security_group_ids[pair[0]]
      port              = pair[1]
    }
  }
}

resource "aws_security_group" "this" {
  name        = var.name
  description = "PlanetScale PrivateLink endpoint."
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = var.name })
}

resource "aws_vpc_security_group_ingress_rule" "client" {
  for_each = local.ingress

  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = each.value.security_group_id
  from_port                    = each.value.port
  to_port                      = each.value.port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_endpoint" "this" {
  vpc_id              = var.vpc_id
  service_name        = var.service_name
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.subnet_ids
  security_group_ids  = [aws_security_group.this.id]
  private_dns_enabled = true
  tags                = merge(var.tags, { Name = var.name })
}

data "aws_network_interface" "this" {
  count = length(var.subnet_ids)
  id    = tolist(aws_vpc_endpoint.this.network_interface_ids)[count.index]
}
