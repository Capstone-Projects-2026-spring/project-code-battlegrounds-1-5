import React, { useState, useEffect } from "react";
import { User, Role } from "./roles";

const RoleBasedTextBoxes: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<Role>("coder");
  const [user, setUser] = useState(new User("user-1", selectedRole));

  useEffect(() => {
    setUser(new User("user-1", selectedRole));
  }, [selectedRole]);

  const handleRoleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(event.target.value as Role);
  };

  const isCoderDisabled = selectedRole !== "coder";
  const isTesterDisabled = selectedRole !== "tester";

  return (
    <div style={styles.body}>
      <div style={styles.selector}>
        <label htmlFor="role-select" style={styles.label}>
          Select Role:
        </label>
        <select
          id="role-select"
          value={selectedRole}
          onChange={handleRoleChange}
          style={styles.select}
        >
          <option value="coder">Coder</option>
          <option value="tester">Tester</option>
          <option value="spectator">Spectator</option>
        </select>
      </div>

      <div style={styles.container}>
        <textarea
          id="coder-box"
          style={styles.textBox}
          placeholder="Coder text box"
          disabled={isCoderDisabled}
        />
        <textarea
          id="tester-box"
          style={styles.textBox}
          placeholder="Tester text box"
          disabled={isTesterDisabled}
        />
      </div>

      <div style={styles.permissionsDisplay}>
        <h3>Current Role Permissions:</h3>
        <ul>
          {user.getPermissions().map((permission) => (
            <li key={permission}>{permission}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const styles = {
  body: {
    margin: 0,
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  } as React.CSSProperties,

  selector: {
    marginBottom: "20px",
  } as React.CSSProperties,

  label: {
    fontWeight: "bold",
    marginRight: "10px",
  } as React.CSSProperties,

  select: {
    padding: "8px",
    fontSize: "14px",
    cursor: "pointer",
  } as React.CSSProperties,

  container: {
    display: "flex",
    gap: "20px",
  } as React.CSSProperties,

  textBox: {
    width: "50%",
    height: "300px",
    padding: "10px",
    fontSize: "14px",
    resize: "vertical",
    fontFamily: "Arial, sans-serif",
  } as React.CSSProperties,

  permissionsDisplay: {
    marginTop: "20px",
    padding: "10px",
    backgroundColor: "#f0f0f0",
    borderRadius: "4px",
  } as React.CSSProperties,
};

export default RoleBasedTextBoxes;
