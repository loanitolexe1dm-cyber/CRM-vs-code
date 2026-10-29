# 💼 CRM Loanitol Master Prompt & System Reference

This document serves as the **Master Prompt** and implementation blueprint for **CRM Loanitol**. It details the application structure, role models, visual characteristics, and data flows, ensuring seamless operations on local or preview setups.

---

## 🏗️ 1. Project Overview & Architecture

**CRM Loanitol** is a fully integrated, high-fidelity customer relationship management platform designed tailored for secure loan processing and tracking. Built using pure-vanilla elements with standard CSS styling, it provides highly optimized desktop/viewport performance.

### 🔌 Real-Time Offline Simulation Engine (Local Persistent Storage)
All physical connections to remote DB endpoints (Firebase and Supabase integration layers) have been disconnected. Instead, the application runs on a robust, state-preserving **Local Persistent Storage Engine**:
- **Durable Local State:** Persists automatically to `localStorage` via client-side synchronizers (`loadLocalState()` and `persistLocalState()`).
- **Demo Data Seeding:** Upon first login, seeds a production-grade database simulation containing standard clients, underwriting worksheets, bank data analysis lists, and TAT trackers.
- **Zero-Dependency Support:** Easily deployable across static containers, offline environments, or local static servers.

---

## 👥 2. Roles, Permissions & Accounts

CRM Loanitol implements hierarchical role-based access control (RBAC). Use the credentials listed below to test dashboards with distinct functional permissions:

| User ID | Role / Designation | Departments & Functional Bounds | Default Password |
| :--- | :--- | :--- | :--- |
| `admin` or `admin_1` | **Admin / Root Administrator** | Full visibility, system setting configurations, user status resets, global logs. | `admin` |
| `msme_head_1` | **MSME Department Head** | Oversees all MSME-categorized loan applications, tasks, and TAT breaches. | `head` |
| `retail_head_1` | **Retail Department Head** | Oversees all Retail-categorized loan applications, tasks, and TAT breaches. | `head` |
| `cse_1`, `cse_2`, `cse_3` | **Customer Service Executive (CSE)** | Core telecalling agents. Responsible for adding new leads, cold tracking, and initiating initial document check validations. | `cse` |
| `cso_msme_1` to `cso_msme_3` | **CSO - MSME Specialist** | Field officers performing physical site assessments, financial analysis, and merits checks. | `cso` |
| `cso_retail_1` to `cso_retail_3` | **CSO - Retail Specialist** | Field officers performing retail physical/site check visits, verification rounds. | `cso` |

---

## ⚙️ 3. Core Functional Workflows

The application manages complex financial underwriting and tracking over a unified interface.

### 📝 A. Lead Life Cycle & Workflow Statuses
Leads progress across standard operational statuses:
`new` ➡️ `appointed` ➡️ `logged-in` ➡️ `sanctioned` ➡️ `disbursed` / `dump` / `hold`.

### ⏱️ B. Real-Time Turnaround Time (TAT) Tracking
Ensures compliance with standard operational parameters:
- **Duration Metrics:** Automatically processes exact durations spent inside specific stages.
- **Visual Color Warnings:** Transitions columns and lists into **warning (orange)** or **breached (red)** styles based on predefined timeline parameters.

### 📁 C. Double-Sided Lead Detail Workspace (Interactive Tabs)
Selecting any lead opens a detailed fullscreen-capable sheet dividing complex workflows:
1. **Lead Info:** High-level status timeline, assignee attributes, and general physical files tracker.
2. **Time Log:** Auto-updating timeline, recording every interaction, remark, and change made by team members.
3. **Stage Durations:** Real-time analytics displaying elapsed periods in hours and days, visual charts mapping workflow bottlenecks.
4. **Underwriting Merits Matrix:** Detailed field metrics grading applicant creditworthiness and structural risks.
5. **Bank Checks Loader:** Record, modify, or analyze bank account lists, statement summaries, and average credit balances.
6. **Detailed Loan History:** Tracks historical/existing loan logs with active EMI parameters.
7. **Calculations Sheet:** Computes standard EMI margins and automated debt-to-income models.
8. **Document Checklist:** Visual compliance indicators divided across custom categories (e.g., KYC, Financials), enabling status overrides, dynamic progress widgets, and bulk updates.
9. **Milestones & Tasks Checklist:** Custom checkpoints tracking internal operations.

---

## 🎨 4. Design Language & CSS Custom Properties

Designed with a premium dark workspace theme using highly polished CSS properties inside `/css/styles.css` and `/css/modern-dashboard.css`:

```css
:root {
  --bg: #0f1015;          /* Deep space visual background */
  --bg2: #161822;         /* Container element fill colors */
  --surface: #1e2230;     /* Highlighted controls, hover surfaces */
  --text: #f3f4f6;        /* High-contrast crisp text */
  --text2: #9ca3af;       /* Dimmed details label typography */
  --gold: #dfb257;        /* Brand color - Amber Gold */
  --gold-dim: #dfb25725;  /* Subtle warning / brand glow */
  --border: #272c3d;      /* Low-impact layout divisions */
}
```

- **Aesthetic Pairings:** Google Font **Outfit** delivers clean display headers, while **JetBrains Mono** provides technical tracking for timestamps and identifiers.

---

## 🚀 5. Quick Local Setup
1. Run `npm install` to set up initial Express framework configurations.
2. Execute `npm start` to run the development server on `port 3000`.
3. Open a browser to `http://localhost:3000` to interact with the local offline sandbox.
