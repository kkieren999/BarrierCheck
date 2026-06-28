# BarrierCheck free-trial and account-deletion policy

## Product rule

Deleting an account deletes the user's app data, but it does not reset free-trial eligibility.

Free trials are limited to one trial per inspector, licence number, business, phone number or other reasonable account identifier.

## Data deletion rule

When an account is deleted, BarrierCheck should delete or de-identify the user's normal app data, including:

- user profile document
- inspection records
- generated reports
- uploaded evidence photos
- client/property details saved inside inspections
- normal account metadata that is no longer needed

## Limited retained record

BarrierCheck may retain a minimal record needed for security, billing, dispute handling, legal compliance and free-trial eligibility.

The trial eligibility record should be stored separately from normal user data, for example:

```txt
trialEntitlements/{licenceHash}
```

Recommended fields:

```js
{
  licenceHash: "server_hmac_sha256_normalised_licence",
  phoneHash: "server_hmac_sha256_normalised_phone",
  trialUsed: true,
  freeInspectionLimitGranted: 3,
  trialStartedAt: timestamp,
  lastAccountDeletedAt: timestamp,
  deletionRecordId: "accountDeletionRecords/...",
  retentionReason: "free_trial_eligibility",
  policyVersion: "2026-06-free-trial-v1"
}
```

Do not store the raw licence number or raw phone number in this retained eligibility record.

## Signup behaviour

On account creation:

1. Normalise the inspector licence number and phone number.
2. Use a server-side function to create HMAC hashes.
3. Check `trialEntitlements` for the licence or phone hash.
4. If no record exists, grant the normal free trial.
5. If a record exists, create the account but set the free-inspection allowance to 0 or require payment/admin review.
6. Show the admin: `Trial already used for this licence/phone.`

## Account deletion behaviour

On account deletion:

1. Disable the account or mark it as deleted.
2. Optionally keep a 30-day restore window.
3. Delete inspections, reports, photos and normal profile data after the restore window.
4. Write/update the minimal trial entitlement record.
5. Write a minimal deletion audit record.

## User-facing wording

Create-account screen:

> First 3 inspections are free once per inspector/licence. Deleting your account does not reset free-trial eligibility.

Deletion screen:

> Deleting your account will delete your profile, inspections, reports and uploaded photos after any restore period. BarrierCheck may retain limited records needed for security, fraud prevention, billing, legal compliance and free-trial eligibility. Deleting your account does not reset your free trial.

Privacy/Terms wording should match the public legal pages.
