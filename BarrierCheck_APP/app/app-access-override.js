// BarrierCheck app access patch.
(function () {
  function canEnter(profile) {
    if (!profile) return false;
    return profile.approved === true
      || profile.role === "admin"
      || profile.admin === true
      || profile.isAdmin === true
      || profile.verificationStatus === "approved"
      || profile.subscriptionStatus === "active"
      || profile.billingAccess === "active";
  }

  window.initFirebase = function () {
    ensureAuthUI();
    if (!window.firebase || !window.firebase.initializeApp) {
      firebaseEnabled = false;
      firebaseLoadError = "Firebase scripts could not load.";
      updateAuthUI();
      return;
    }

    try {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      firebaseAuth = firebase.auth();
      firebaseDb = firebase.firestore();
      firebaseStorage = firebase.storage ? firebase.storage() : null;
      firebaseFunctions = firebase.functions ? firebase.functions() : null;
      firebaseEnabled = true;

      firebaseAuth.onAuthStateChanged(function (user) {
        firebaseUser = user || null;
        firebaseDataLoaded = false;
        firebaseApprovalChecked = false;
        firebaseApproved = false;
        firebaseBillingActive = false;
        firebaseBillingMessage = "Billing status not checked yet.";
        firebaseBillingState = null;
        currentUserProfile = {};
        inspectorProfile = null;
        profileCompleted = false;
        currentInspectorSnapshot = null;
        cloudInspections = [];

        if (cloudUnsubscribe) {
          cloudUnsubscribe();
          cloudUnsubscribe = null;
        }

        if (!firebaseUser) {
          currentInspectionId = null;
          inspectionStarted = false;
          updateAuthUI();
          return;
        }

        updateAuthUI();

        ensureCurrentUserProfile().then(function (profile) {
          firebaseApprovalChecked = true;
          currentUserProfile = profile || {};
          inspectorProfile = normalizeInspectorProfile(currentUserProfile.inspectorProfile || {});
          profileCompleted = !!(currentUserProfile.profileCompleted === true && isInspectorProfileComplete(inspectorProfile));
          firebaseApproved = canEnter(profile);
          firebaseBillingState = getBillingAccessState(currentUserProfile || {});
          firebaseBillingActive = !!firebaseBillingState.active;
          firebaseBillingMessage = firebaseBillingState.message || "Access status unavailable.";

          if (!firebaseApproved) {
            firebaseDataLoaded = true;
            updateAuthUI();
            return;
          }

          updateAuthUI();
          listenToCloudInspections();
        }).catch(function (error) {
          console.error(error);
          firebaseApprovalChecked = true;
          firebaseApproved = false;
          firebaseDataLoaded = true;
          firebaseLoadError = "Could not check account approval. Check Firestore rules.";
          setFirebaseStatus(firebaseLoadError, true);
          updateAuthUI();
        });
      });
    } catch (error) {
      console.error(error);
      firebaseEnabled = false;
      firebaseLoadError = "Firebase setup failed: " + error.message;
      updateAuthUI();
    }
  };
})();
