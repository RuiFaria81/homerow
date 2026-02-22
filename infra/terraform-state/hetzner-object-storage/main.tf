terraform {
  required_providers {
    minio = {
      source  = "aminueza/minio"
      version = "~> 3.5"
    }
  }
}

provider "minio" {
  minio_server   = "${var.location}.your-objectstorage.com"
  minio_user     = var.s3_access_key
  minio_password = var.s3_secret_key
  minio_region   = var.location
  minio_ssl      = true
}

resource "minio_s3_bucket" "terraform_state" {
  bucket = var.bucket_name
  acl    = "private"
}

variable "location" {
  type    = string
  default = "nbg1"
}

variable "s3_access_key" {
  type      = string
  sensitive = true

  validation {
    condition     = trimspace(var.s3_access_key) != ""
    error_message = "s3_access_key must not be empty."
  }
}

variable "s3_secret_key" {
  type      = string
  sensitive = true

  validation {
    condition     = trimspace(var.s3_secret_key) != ""
    error_message = "s3_secret_key must not be empty."
  }
}

variable "bucket_name" {
  type = string

  validation {
    condition     = trimspace(var.bucket_name) != ""
    error_message = "bucket_name must not be empty."
  }
}

output "bucket_name" {
  value = minio_s3_bucket.terraform_state.bucket
}
