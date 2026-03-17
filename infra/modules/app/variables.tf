variable "region" { type = string }
variable "image_url" { type = string }
variable "db_user" { type = string }
variable "better_auth_url" { type = string }

# from bootstrap module
variable "vpc_network_id" { type = string }
variable "vpc_connector_id" { type = string }
variable "vpc_connector_name" { type = string }
