# CloudSight Strategic Roadmap & Vision

This document outlines the strategic evolution of the CloudSight platform, transitioning it from a pure client-side browser extension into an enterprise-grade, AI-native multi-cloud FinOps product.

---

## 🔼 Level 1 — Architectural Maturity Upgrade

**Current State:**
* Pure client-side browser extension.
* Secrets stored locally (AES-GCM encrypted).
* Background polling restricted to browser uptime via Chrome Alarms (every 6 hours).

**Next Evolution (Hybrid Architecture):**
* **Lightweight Ingestion Backend:** Introduce an API layer to aggregate data independently.
* **New Flow:** Browser authenticates $\rightarrow$ Backend fetches billing data securely $\rightarrow$ Normalizes spend into a central database $\rightarrow$ Extension shifts to a pure visualization/presentation layer.
* **Unlocks:** Org-wide aggregation, long-term historical storage (beyond 14 days), un-interrupted ingestion (no dependency on Chrome being open), and a full Web Dashboard outside the browser. *CloudSight becomes a standalone product.*

---

## 🔼 Level 2 — Build a Unified Cost Engine

**Current State:**
* Flat, simple `dashboardData` normalization for immediate UI rendering.

**Next Evolution (Formal Schema):**
* Create a strict, provider-agnostic cost data schema:
  ```json
  {
    "provider": "AWS|Azure|GCP",
    "accountId": "string",
    "subscriptionId": "string",
    "projectId": "string",
    "service": "string",
    "region": "string",
    "usageType": "string",
    "cost": "number",
    "currency": "string",
    "timestamp": "ISO8601"
  }
  ```
* **Unlocks:** Direct cross-cloud comparisons (AWS EC2 vs Azure VM vs GCP Compute), cross-cloud compute heatmaps, and a truly unified provider-agnostic query engine.

---

## 🔼 Level 3 — Intelligent FinOps Layer

**Current State:**
* Basic 14-day history plotting, static end-of-month forecasting, and rudimentary threshold anomalies.

**Next Evolution (Data Science & Analytics):**
* **Statistical Anomaly Detection:** Rolling Z-score anomaly tracking, seasonal baseline corrections (e.g., ignoring Friday dips), and weekly pattern normalization.
* **Advanced Forecasting Models:** Shift from simple linear projections to Holt-Winters models to respect intra-month structural seasonality. Calculate Budget Exhaustion Probability grids.
* **Cost Velocity Tracking:** Measure the *rate of change*. Calculate Spend Acceleration, Daily Burn Rate, and Cost Growth Momentum to answer *"Are we spending more, and how fast is it augmenting?"*

---

## 🔼 Level 4 — Optimization Intelligence

**Current State:**
* Reporting actuals without actionable guidance.

**Next Evolution (Actionable FinOps Recommendations):**
* Surface real, actionable savings opportunities.
* **AWS:** Flag EC2 instances running under 10% CPU for downsizing, identify unattached EBS volumes, and dormant ELBs.
* **Azure:** Suggest VM right-sizing, isolate unassociated Public IPs, and flag unused App Service plans.
* **GCP:** Detect idle compute instances and perform sustained use discount gap analysis.
* **Unlocks:** CloudSight evolves into an active, multi-cloud cost optimization engine, not just a passive dashboard.

---

## 🔼 Level 5 & 6 — Role-Based Dashboards & Personas

**Next Evolution (Adaptive UI):**
Implement distinct dashboard "modes" depending on the user persona:
* **Engineer View:** Service breakdowns, deep region utilization, tag-based analysis, and resource efficiency.
* **FinOps View:** Active budget tracking, forecast modeling, and daily burn rate tracking.
* **Executive View:** Macro month-over-month trends, cloud distribution pie models, and financial runway projections.

---

## 🔼 Level 7 — Security & Authentication Upgrades

**Current State:**
* Secure AES-GCM static keys held in local browser vault.

**Next Evolution (Secretless Authentication):**
* Migrate away from static keys entirely toward enterprise federated identity workflows.
* **AWS:** OIDC Role Assumption (No static IAM secrets stored).
* **Azure:** Managed Identity / Federated Credentials using active workload identity matrices.
* **GCP:** Workforce Identity Federation configuration.
* **Unlocks:** The capability to claim zero-trust, secretless authentication support for enterprise compliance audits.

---

## 🔼 Level 8 — The AI Layer (2026 Vision)

**Next Evolution (AI-Native Assistant):**
* Implement LLM-backed Natural Language Querying directly in the UI.
  * *Query:* *"Why did Azure cost spike yesterday?"*
  * *Engine:* Analyzes grouped service data, compares against trailing baselines, and generates a structured, conversational explanation.
* **Automated Weekly Summaries:** Proactively generate insights like, *"This week, your AWS EC2 cluster increased by 18% due to higher spot pricing in ap-south-1."*

---

## 🔼 Level 9 — Observability for CloudSight

**Next Evolution (Self-Monitoring Resilience):**
* A serious platform must monitor its own health.
* Add native tracking for API polling latency to AWS/Azure/GCP.
* Record Token refresh failure metrics and implement structured error classification logging.
* Monitor cloud provider API availability.
* **Unlocks:** High availability, actionable debugging without touching the client browser, and enterprise SLAs.
