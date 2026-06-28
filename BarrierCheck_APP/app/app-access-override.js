// BarrierCheck app access patch.
(function () {
  function clean(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function canEnter(profile) {
    if (!profile) return false;
    var role = clean(profile.role).toLowerCase();
    var billing = clean(profile.billingAccess || profile.subscriptionStatus).toLowerCase();
    var verification = clean(profile.verificationStatus).toLowerCase();
    var subscription = clean(profile.subscriptionStatus).toLowerCase();

    if (["rejected", "suspended", "blocked"].indexOf(role) >= 0) return false;
    if (["rejected", "suspended", "blocked"].indexOf(billing) >= 0) return false;
    if (["rejected", "suspended", "blocked"].indexOf(verification) >= 0) return false;
    if (["rejected", "suspended", "blocked"].indexOf(subscription) >= 0) return false;

    return profile.approved === true
      || role === "admin"
      || profile.admin === true
      || profile.isAdmin === true
      || verification === "approved"
      || billing === "active"
      || subscription === "active"
      || billing === "free_inspections"
      || subscription === "free_inspections"
      || verification === "pending"
      || verification === "needs_more_info";
  }

  function defaultProfileIcon() {
    return { type: "default", photoURL: "", avatarId: "default" };
  }

  function profileShape(profile, user) {
    var p = profile || {};
    var email = p.inspectorEmail || p.reportEmail || (user && user.email) || "";
    var phone = p.inspectorPhone || p.reportPhone || "";
    return {
      inspectorName: p.inspectorName || (user && user.displayName) || "",
      licenceNumber: p.licenceNumber || "",
      inspectorEmail: email,
      inspectorPhone: phone,
      businessName: p.businessName || "",
      businessAddress: p.businessAddress || "",
      businessAbn: p.businessAbn || "",
      businessWebsite: p.businessWebsite || "",
      reportEmail: p.reportEmail || email,
      reportPhone: p.reportPhone || phone,
      reportLogoUrl: p.reportLogoUrl || "",
      reportFooterText: p.reportFooterText || "",
      inspectionNumberPrefix: p.inspectionNumberPrefix || "BC",
      profileIcon: p.profileIcon || defaultProfileIcon()
    };
  }

  function profileIsComplete(p) {
    return !!(p && p.inspectorName && p.licenceNumber && p.inspectorEmail && p.inspectorPhone && p.businessName && p.profileIcon && p.profileIcon.type);
  }

  function trialFields(profile) {
    var billing = clean(profile && profile.billingAccess).toLowerCase();
    var subscription = clean(profile && profile.subscriptionStatus).toLowerCase();
    var blocked = ["rejected", "suspended", "blocked"].indexOf(billing) >= 0 || ["rejected", "suspended", "blocked"].indexOf(subscription) >= 0;
    if (blocked) return {};
    return {
      billingAccess: billing && billing !== "pending_verification" ? profile.billingAccess : "free_inspections",
      subscriptionStatus: subscription && subscription !== "pending_verification" ? profile.subscriptionStatus : "free_inspections",
      freeInspectionLimit: Number(profile && profile.freeInspectionLimit || 3),
      freeInspectionsUsed: Number(profile && profile.freeInspectionsUsed || 0)
    };
  }

  function repairProfileIfNeeded(profile, user) {
    var shaped = profileShape(profile && profile.inspectorProfile, user);
    var complete = profileIsComplete(shaped);
    var accessDefaults = trialFields(profile || {});
    var fixed = Object.assign({}, profile || {}, accessDefaults, {
      inspectorProfile: shaped,
      profileCompleted: complete
    });

    if (firebaseDb && user) {
      firebaseDb.collection("users").doc(user.uid).set(Object.assign({
        email: user.email || fixed.email || "",
        displayName: user.displayName || fixed.displayName || "",
        inspectorProfile: shaped,
        profileCompleted: complete,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, accessDefaults), { merge: true }).catch(function (error) {
        console.warn("Could not repair profile shape", error);
      });
    }

    return fixed;
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
          profile = repairProfileIfNeeded(profile, firebaseUser);
          firebaseApprovalChecked = true;
          currentUserProfile = profile || {};
          inspectorProfile = normalizeInspectorProfile(currentUserProfile.inspectorProfile || {});
          profileCompleted = profileIsComplete(inspectorProfile);
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
