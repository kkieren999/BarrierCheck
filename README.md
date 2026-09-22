# BarrierCheck

BarrierCheck is the production pool-safety inspection web app for Queensland inspectors.

## Active architecture

- **Public website:** root `index.html` plus `contact/`, `privacy/`, `refunds/` and `terms/`.
- **App entry point:** `/app/`, which frames `BarrierCheck_APP/app/index.html`.
- **Inspection runtime:** `BarrierCheck_APP/app/script.js` is now stored locally in this repository. The streamlined inspection/question/report layers in the same directory are loaded directly by the app.
- **Authentication/data:** Firebase Authentication, Firestore and Storage in project `barriercheck-32290`.
- **Server-side access controls:** root `functions/`, `firestore.rules` and `storage.rules`.
- **Deployment:** GitHub Pages deploys the static site from `main`; Firebase functions/rules are deployed separately.

## Important deployment order

When backend access logic changes, deploy Firebase Functions before stricter Firestore/Storage rules.

```bash
firebase use barriercheck-32290
cd functions && npm install && npm run lint && cd ..
firebase deploy --only functions --project barriercheck-32290
firebase deploy --only firestore:rules,storage --project barriercheck-32290
```

The legacy duplicate Firebase backend and the isolated workflow preview have been removed from the active tree so there is one production source of truth.
