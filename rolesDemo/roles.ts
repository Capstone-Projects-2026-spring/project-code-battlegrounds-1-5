import { ROLE_PERMISSIONS } from "./permissions";

export type Role = "coder" | "tester" | "spectator";

export class User {
  id: string;
  role: Role;

  constructor(id: string, role: Role) {
    this.id = id;
    this.role = role;
  }

  getPermissions(): readonly string[] {
    return ROLE_PERMISSIONS[this.role];
  }
}