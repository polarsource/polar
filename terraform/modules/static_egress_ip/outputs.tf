output "allocation_id" {
  description = "Allocation ID of the Elastic IP, consumed by a NAT gateway."
  value       = aws_eip.this.allocation_id
}

output "public_ip" {
  description = "The static public IP. Add this (as a /32) to the database IP allow list."
  value       = aws_eip.this.public_ip
}
