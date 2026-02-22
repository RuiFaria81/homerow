terraform {
  backend "s3" {}

  required_providers {
    hcloud = {
      source = "hetznercloud/hcloud"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

resource "hcloud_ssh_key" "admin" {
  count = var.existing_server_id == null && var.existing_ssh_key_id == null ? 1 : 0

  name       = "admin_key"
  public_key = file(var.ssh_public_key_path)
}

locals {
  ssh_key_id = var.existing_server_id != null ? null : (var.existing_ssh_key_id != null ? var.existing_ssh_key_id : hcloud_ssh_key.admin[0].id)
  server_id  = var.existing_server_id != null ? var.existing_server_id : hcloud_server.mail[0].id
}

resource "hcloud_server" "mail" {
  count = var.existing_server_id == null ? 1 : 0

  name        = "mail-server"
  server_type = var.server_type
  image       = "debian-12"
  location    = var.location
  ssh_keys    = [local.ssh_key_id]

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }
}

resource "hcloud_rdns" "mail_ptr" {
  count = var.existing_server_id == null ? 1 : 0

  server_id  = hcloud_server.mail[0].id
  ip_address = hcloud_server.mail[0].ipv4_address
  dns_ptr    = "mail.${var.domain}"
}

resource "hcloud_firewall" "mail" {
  name = "mail-server-firewall"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = var.allowed_ssh_cidrs
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "25"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "143"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "465"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "587"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "993"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "icmp"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_firewall_attachment" "mail" {
  firewall_id = hcloud_firewall.mail.id
  server_ids  = [local.server_id]
}

variable "domain" {
  type = string
}

variable "hcloud_token" {
  type      = string
  sensitive = true

  validation {
    condition     = trimspace(var.hcloud_token) != ""
    error_message = "hcloud_token must not be empty."
  }
}

variable "server_type" {
  type    = string
  default = "cx23"
}

variable "location" {
  type    = string
  default = "nbg1"
}

variable "ssh_public_key_path" {
  type = string
}

variable "allowed_ssh_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0", "::/0"]
}

variable "existing_ssh_key_id" {
  type    = number
  default = null
}

variable "existing_server_id" {
  type    = number
  default = null
}

variable "existing_server_ipv4" {
  type    = string
  default = null

  validation {
    condition     = (var.existing_server_id == null && var.existing_server_ipv4 == null) || (var.existing_server_id != null && trimspace(var.existing_server_ipv4) != "")
    error_message = "existing_server_ipv4 must be set when existing_server_id is provided."
  }
}

output "server_ip" {
  value = var.existing_server_id != null ? var.existing_server_ipv4 : hcloud_server.mail[0].ipv4_address
}
