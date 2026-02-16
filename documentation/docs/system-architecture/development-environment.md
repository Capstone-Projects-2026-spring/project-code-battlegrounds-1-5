---
sidebar_position: 4
---

# Development Environment

This page outlines the required hardware, software, and core libraries necessary to develop and test the **Code Battlegrounds** platform.

---

## 💻 Software & Frameworks

### **Core Tooling**
* **IDE:** [Visual Studio Code](https://code.visualstudio.com/) or similar.
* **Package Manager:** `npm` ([Node Package Manager](https://www.npmjs.com/))
* **Runtime & Build Tool:** [Bun](https://bun.com/)

### **Programming Languages**
* **Primary:** TypeScript 
* **Scripting:** JavaScript 

---

##  Technical Stack

### **Frontend**
The UI is built with a focus on speed and modularity:
* **Framework:** [React](https://react.dev/)
* **UI Library:** [Mantine](https://mantine.dev/) (Core, Hooks, and Form components).
* **Icons:** Tabler Icons.

### **Backend & Infrastructure**
* **Environment:** [Node.js](https://nodejs.org/)
* **Real-time Communication:** [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
* **Caching & State Store:** [Redis](https://redis.io/).
* **Authoritative & Persistent Store**: [PostgreSQL](https://www.postgresql.org/)
* **Deployment** Deployed via [Google Cloud Platform](https://cloud.google.com) (see [Infrastructure Architecture](infrastructure-architecture.md))

---

##  Development Hardware Requirements
Devs will run the `docker-compose.yml` file after `source`-ing the `.env` file. The app will work in development with the same environment variables as in production (see [Infrastructure Architecture](infrastructure-architecture.md)). 

| Category              | Supported Platforms / Devices                                                                                                |
|:----------------------|:-----------------------------------------------------------------------------------------------------------------------------|
| **Operating Systems** | Windows 10/11, macOS, Linux                                                                                                  |
| **Testing Devices**   | Modern Desktop Web Browsers (Chrome, Firefox, Safari)                                                                        |
| **Minimum RAM**       | 8GB (16GB recommended)                                                                                                       |
| **Local Dev Prereqs** | IDEs, Bun runtime, `docker-compose.yml`, and `.env` file (see [Infrastructure Architecture](infrastructure-architecture.md)) |
---
##  End User Hardware Requirements

| Category              | Supported Platforms / Devices                         |
|:----------------------|:------------------------------------------------------|
| **Operating Systems** | Windows 10/11, macOS, Linux                           |
| **Testing Devices**   | Modern Desktop Web Browsers (Chrome, Firefox, Safari) |
| **Minimum RAM**       | 8GB (16GB recommended)                                |

---
