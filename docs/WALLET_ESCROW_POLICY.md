# Wallet & Escrow Policy (Investor ↔ Farmer)

## 1) Core Wallet Model
- Every user has a wallet with:
- `main_balance`: available cash.
- `escrow_locked`: investor capital currently committed in live livestock cycles.

## 2) Investor Flow
- Investor adds funds to `main_balance`.
- On investment, funds are treated as project escrow allocation.
- Investor can submit withdrawal requests from available balance only.
- Withdrawals are processed by admin treasury approval workflow.

## 3) Farmer Funding Release Rules
- Investor capital is not transferred directly to farmer at invest click.
- Capital moves to farmer wallet through admin-controlled escrow releases.
- Release is allowed only when:
- Project status is `funded`, `in_progress`, or `active`.
- Farmer KYC/account status is approved.
- Requested release does not exceed remaining project escrow.

## 4) Release Milestones
- `initial_purchase`: first tranche for animal purchase.
- `feed_milestone`: operating feed/care tranche.
- `vet_milestone`: veterinary checkpoint tranche.
- `ops_expense`: approved operational need.
- `sale_settlement`: final settlement after sale.

## 5) Settlement Logic
- On release, investor-side escrow is reduced proportionally by invested share.
- Farmer wallet receives approved amount.
- Every release creates treasury records for auditability.

## 6) Governance
- Admin treasury can approve/reject withdrawal requests.
- Admin treasury can release escrow with reason notes.
- All money movement must produce transaction/audit entries.
