data "aws_region" "current" {}

data "aws_subnet" "this" {
  id = var.subnet_id
}

data "aws_ssm_parameter" "ami" {
  count = var.ami_id == null ? 1 : 0
  name  = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name                 = var.name
  assume_role_policy   = data.aws_iam_policy_document.assume_role.json
  permissions_boundary = var.permissions_boundary_arn
  tags                 = var.tags
}

data "aws_iam_policy_document" "auth_key" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.tailscale_auth_key_secret_arn]
  }

  dynamic "statement" {
    for_each = var.tailscale_auth_key_kms_key_arn == null ? [] : [var.tailscale_auth_key_kms_key_arn]

    content {
      actions   = ["kms:Decrypt"]
      resources = [statement.value]
    }
  }
}

resource "aws_iam_role_policy" "auth_key" {
  name   = "tailscale-auth-key"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.auth_key.json
}

resource "aws_iam_instance_profile" "this" {
  name = var.name
  role = aws_iam_role.this.name
  tags = var.tags
}

resource "aws_security_group" "this" {
  name_prefix = "${var.name}-"
  description = "Outbound access for Tailscale and package installation."
  vpc_id      = data.aws_subnet.this.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = var.name })
}

resource "aws_instance" "this" {
  ami                         = var.ami_id != null ? var.ami_id : data.aws_ssm_parameter.ami[0].value
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  associate_public_ip_address = var.associate_public_ip_address
  vpc_security_group_ids      = [aws_security_group.this.id]
  iam_instance_profile        = aws_iam_instance_profile.this.name
  user_data_replace_on_change = true
  source_dest_check           = length(var.advertise_routes) == 0

  user_data = "#cloud-config\n${yamlencode({
    write_files = concat([{
      path        = "/usr/local/sbin/tailscale-init"
      owner       = "root:root"
      permissions = "0700"
      content     = file("${path.module}/tailscale-init.sh")
      }], length(var.advertise_routes) == 0 ? [] : [{
      path        = "/etc/sysctl.d/99-tailscale.conf"
      owner       = "root:root"
      permissions = "0644"
      content     = "net.ipv4.ip_forward = 1\nnet.ipv6.conf.all.forwarding = 1\n"
    }])
    runcmd = [[
      "/usr/local/sbin/tailscale-init",
      data.aws_region.current.name,
      var.tailscale_auth_key_secret_arn,
      var.name,
      tostring(var.tailscale_ssh),
      join(",", var.advertise_routes),
    ]]
  })}"

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = var.root_volume_size
    tags        = merge(var.tags, { Name = var.name })
  }

  tags = merge(var.tags, { Name = var.name })

  depends_on = [aws_iam_role_policy.auth_key]
}
