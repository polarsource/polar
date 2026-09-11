output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.this.id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets."
  value       = aws_subnet.private[*].id
}

output "private_subnet_cidr_blocks" {
  description = "CIDR blocks of the primary private subnets."
  value       = aws_subnet.private[*].cidr_block
}

output "public_subnet_id" {
  description = "ID of the public subnet."
  value       = aws_subnet.public.id
}

output "secondary_private_subnet_ids" {
  description = "IDs of the private subnets in the secondary CIDR block."
  value       = aws_subnet.private_secondary[*].id
}

output "secondary_private_subnet_cidr_blocks" {
  description = "CIDR blocks of the secondary private subnets."
  value       = aws_subnet.private_secondary[*].cidr_block
}
