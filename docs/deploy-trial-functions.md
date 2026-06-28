# Deploy BarrierCheck trial entitlement functions

These steps deploy the server-side free-trial eligibility check.

## 1. Open Cloud Shell or local terminal

Use the BarrierCheck Firebase project:

```bash
firebase use barriercheck-32290
```

If Firebase CLI is not installed:

```bash
npm install -g firebase-tools
firebase login
```

## 2. Set the HMAC secret

Do not paste this secret into ChatGPT, GitHub, or client-side code.

Generate a random value and save it as a Firebase Functions secret:

```bash
firebase functions:secrets:set TRIAL_HMAC_SECRET --project barriercheck-32290
```

Paste a long random value when prompted. Example generation commands:

```bash
openssl rand -base64 48
```

or:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

## 3. Install function dependencies

From the repository root:

```bash
cd functions
npm install
npm run lint
cd ..
```

## 4. Deploy functions first

Deploy the backend before deploying the stricter Firestore rules:

```bash
firebase deploy --only functions --project barriercheck-32290
```

This deploys:

- `createAccountProfile`
- `requestAccountDeletion`

## 5. Then deploy Firestore rules

Only do this after the functions deploy succeeds:

```bash
firebase deploy --only firestore:rules --project barriercheck-32290
```

These rules stop users from creating their own profile directly. New account creation then depends on the server-side Cloud Function.

## 6. Test

Open:

```txt
https://barriercheck.com.au/app/login/?fresh=trial-function1
```

Create a new account using a test inspector licence.

Expected Firestore results:

```txt
users/{uid}.trialEntitlementCheckStatus = granted
users/{uid}.freeInspectionLimit = 3
trialEntitlements/licence_<hash>
trialEntitlements/phone_<hash>
```

Then create another account with the same licence or phone.

Expected result:

```txt
users/{newUid}.trialEntitlementCheckStatus = already_used
users/{newUid}.freeInspectionLimit = 0
```

## Important

After the stricter Firestore rules are deployed, account creation depends on the Cloud Function. If the function is not deployed, new account creation will fail instead of granting a client-side free trial.
