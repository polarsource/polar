output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.this.id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets (route egress through the NAT gateway)."
  value       = aws_subnet.private[*].id
}

output "public_subnet_id" {
  description = "ID of the public subnet hosting the NAT gateway."
  value       = aws_subnet.public.id
}
