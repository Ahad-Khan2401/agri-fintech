# Platform Policy: Farmer Financing + Risk Sharing

## Purpose
This policy defines operating and compliance rules for the MaweshiHub financing model where farmers operate livestock using pooled capital and shared risk.

## 1. Farmer Onboarding Policy
- Every farmer must complete KYC before project creation.
- Required minimum verification:
  - CNIC evidence
  - Face match / selfie proof
  - Bank account proof for payouts
- Admin must issue an approval or rejection decision with a reason note.

## 1.1 Investor Onboarding Policy
- Every investor must complete KYC before funding access.
- Required minimum verification:
  - CNIC evidence
  - Face match / selfie proof
  - Bank account proof
- Investor accounts remain in pending state until admin manual approval.

## 1.2 Admin Identity Policy
- Admin accounts do **not** go through platform KYC workflow.
- Admin authorization is controlled through internal role assignment and restricted access policies.

## 1.3 Two-Factor Authentication Policy
- Google Authenticator (QR-based TOTP) is mandatory for all roles: farmer, investor, and admin.
- Accounts without verified authenticator factor are blocked from protected dashboard routes.
- Admin approval actions should only be performed from 2FA-verified sessions.

## 2. Financing Project Approval Policy
- Draft project must include:
  - Valid animal details
  - Cost and share structure
  - Farmer stake and basic risk suitability
- Projects with suspicious valuation, missing media, or inconsistent details must be rejected or flagged.
- Admin project approval moves project from `draft` to `medical_review`.
- Only doctor-cleared projects can move from `medical_review` to `active`.

## 2.1 Medical Clearance and Insurance Policy
- Every project requires independent medical clearance before investor funding visibility.
- Doctor assignment, report submission, medical fee, and insurance cover are governed by `docs/MEDICAL_INSURANCE_RISK_POLICY.md`.
- Medical rejection creates a risk flag and blocks public funding.

## 3. Risk Control Policy
- All pending fraud/risk flags must be reviewed within 24 hours.
- Severity thresholds:
  - Low: monitor and annotate
  - Medium: require manual verification
  - High: freeze approval flow until resolved
- Repeat high-risk actors should be escalated for account restriction.

## 4. Sale Verification and Payout Governance
- Admin verifies sale request evidence before approval.
- Approved sale updates project lifecycle and unlocks payout/distribution logic.
- Rejected sales require documented reason and optional re-submission path.

## 5. Audit and Accountability Policy
- Material actions must be recorded in audit logs:
  - KYC decisions
  - Project decisions
  - Sale approvals/rejections
  - Risk flag resolutions
- Audit records should be exportable for compliance and dispute resolution.

## 5.1 Wallet and Escrow Governance
- Investor deposits stay in investor wallet until committed to project escrow.
- Farmer receives funded capital only through admin-approved escrow release milestones.
- Withdrawal requests (investor/farmer) require admin treasury approval before payout.
- Detailed treasury flow is documented in `docs/WALLET_ESCROW_POLICY.md`.

## 6. SLA Standards
- KYC review: within 24-48 hours.
- Project approval: under 24 hours after complete submission.
- Risk flag response: same day.
- Sale verification: within 24 hours.

## 7. Enforcement
- Admin users are required to follow this policy.
- Persistent non-compliance in decisions or logging is subject to role review.
- This policy should be updated whenever product flow or regulation changes.
