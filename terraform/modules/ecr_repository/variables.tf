variable "name" {
  description = "ECR repository name."
  type        = string
}

variable "image_tag_mutability" {
  description = "Image tag mutability setting."
  type        = string
  default     = "MUTABLE"
}

variable "scan_on_push" {
  description = "Whether ECR scans images on push."
  type        = bool
  default     = true
}

variable "max_image_count" {
  description = "Number of recent images to retain."
  type        = number
  default     = 50
}
