variable "region" { type = string }
variable "image_url" { type = string }
variable "db_user" { type = string }

# from bootstrap module
variable "vpc_network_id" { type = string }
variable "vpc_connector_id" { type = string }
variable "vpc_connector_name" { type = string }
