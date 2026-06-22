variable "name" {
  description = "Name tag for the Elastic IP."
  type        = string
}

variable "tags" {
  description = "Tags applied to the Elastic IP."
  type        = map(string)
  default     = {}
}
