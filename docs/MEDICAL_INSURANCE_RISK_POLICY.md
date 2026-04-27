# Medical, Insurance & Risk-Control Policy

## 1. Listing Gate
- Farmer can submit livestock only after farmer KYC approval.
- Submitted livestock starts as `draft`.
- Admin project screening moves eligible livestock to `medical_review`.
- No project becomes investor-visible until medical clearance is approved.

## 2. Doctor Network
- Doctors are onboarded city-wise, starting with Karachi, Lahore, Islamabad, Faisalabad, Multan, and other large livestock markets.
- Doctor profile must include phone, city, fee, clinic/license details when available.
- Each medical assignment records doctor, farmer, livestock, city, fee, due date, and status.

## 3. Medical Report
- Doctor must submit:
- Weight, temperature, heart rate, health status, detailed notes, and final recommendation.
- Approved report marks livestock `active`.
- Rejected report marks livestock `rejected` and creates a risk flag for admin review.

## 4. Medical Fee
- Medical fee is recorded per animal through assignment `fee_amount`.
- Platform may pay the doctor on behalf of the application and recover cost through project economics, platform fee, or insurance/operations budget.

## 5. Insurance
- Insurance is prepared after doctor clearance.
- Coverage can include death, disease, and theft.
- Policy attaches to livestock before investor funding visibility where insurance is requested.

## 6. Fraud Controls
- Farmer cannot self-clear medical status.
- Doctor cannot directly activate a listing without admin-recorded report submission.
- Rejected medical reports generate fraud/risk flags.
- Admin reviews suspicious doctor/farmer/investor activity through risk queue and audit records.
