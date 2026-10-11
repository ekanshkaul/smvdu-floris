# Security Policy

## Supported Versions

Only the latest deployment served on the `main` branch receives active security updates and vulnerability patches.

| Version / Branch | Supported          |
| ----------------- | ------------------ |
| `main` (Latest)   | :white_check_mark: |
| Older releases    | :x:                |

---

## Reporting a Vulnerability

We take the security and integrity of the **SMVDU Floris** platform, its botanical datasets, and its client-side infrastructure seriously.

If you identify a security vulnerability (such as Cross-Site Scripting, sensitive data leakage, or service worker integrity issues):

1. **Do not open a public issue.** Please report the finding privately to prevent exploitation.
2. Contact the maintainer directly via **GitHub Private Vulnerability Reporting**:
   - Go to the repository's **Security** tab.
   - Click **Report a vulnerability** to submit an advisory draft.
   - Alternatively, reach out directly via the email listed on the maintainer's GitHub profile.

### Please include in your report:
- A clear description of the vulnerability.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- The impacted file(s) or endpoint(s).
- Any potential impact on users or offline caching pipelines.

---

## Response Timeline

- **Initial Response:** Within 48 hours acknowledging receipt of the report.
- **Triage & Assessment:** Within 5 business days to validate and determine severity.
- **Resolution:** Critical patches will be committed to `main` and deployed via GitHub Pages as soon as verified.
