---
sidebar_position: 5
---

# Version Control & Workflow

This project utilizes **Git** for version control with **GitHub** serving as the central repository host. We employ a **Monorepo** structure to manage both our documentation and application code in a single location.

---

## Repository Structure
The repository is organized to maintain a clear separation between product and documentation:
* **`/docs`**: Docusaurus-based project documentation.
* **`/src/`**: The core **Code BattleGrounds** web application.

---

## Branching Strategy
To ensure stability, we follow a feature-branch workflow:

| Branch | Purpose | Permissions |
| :--- | :--- | :--- |
| `main` | **Production Ready.** Contains the latest stable release. | **Protected.** No direct pushes. |
| `feat/*` | Active development of new features or user stories. | Developer-owned. |
| `fix/*` | Critical bug fixes or patches. | Developer-owned. |

---

## Pull Request (PR) Rules
All changes must pass through a formal review process to maintain code quality:

1. **Mandatory PRs:** Direct merges to `main` are strictly prohibited.
2. **Approval Conditions:** At least **one peer approval** is required before a merge can occur.
3. **No Bypassing:** Administrators cannot bypass branch protection rules.

---

## Sprint & Issue Tracking
We utilize **Jira** as our source for project management:
* **User Stories:** Detailed requirements defined in Jira.
* **Issue Tracking:** All bugs and tasks must have a corresponding Jira ticket (e.g., `CB-101`).
* **Sprints:** Two-week development cycles

---

## Commit Conventions
To keep the history readable, please use the following prefix format:
* `feat:` A new feature.
* `fix:` A bug fix.
* `docs:` Documentation changes only.
