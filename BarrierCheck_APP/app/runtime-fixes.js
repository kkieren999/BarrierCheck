// BarrierCheck production runtime fixes.
// Keeps billing/trial enforcement server-authoritative and ensures iframe navigation
// always returns users to the clean top-level routes.
(function () {
  "use strict";

  var startingInspection = false;

  function numeric(value, fallback) {
    return typeof value === "number" && isFinite(value) ? value : fallback;
  }

  function topNavigate(path) {
    try {
      if (window.top && window.top !== window) {
        window.top.location.replace(path);
        return;
      }
    } catch (error) {}
    window.location.replace(path);
  }

  window.getFreeInspectionsRemaining = function (profile) {
    var p = profile || {};
    var limit = numeric(p.freeInspectionLimit, 3);
    var used = numeric(p.freeInspectionsUsed, 0);
    return Math.max(0, limit - used);
  };

  window.incrementFreeInspectionUsageIfNeeded = function () {
    if (!firebaseUser || hasPaidSubscription(currentUserProfile)) {
      return Promise.resolve({ consumed: false });
    }

    return callFirebaseFunction("consumeFreeInspection", {}).then(function (data) {
      data = data || {};
      if (typeof data.freeInspectionLimit === "number") {
        currentUserProfile.freeInspectionLimit = data.freeInspectionLimit;
      }
      if (typeof data.freeInspectionsUsed === "number") {
        currentUserProfile.freeInspectionsUsed = data.freeInspectionsUsed;
      }
      firebaseBillingState = getBillingAccessState(currentUserProfile || {});
      firebaseBillingActive = !!firebaseBillingState.active;
      firebaseBillingMessage = firebaseBillingState.message || "Access status unavailable.";
      updateAuthUI();
      return data;
    });
  };

  window.showSubscribePrompt = function () {
    var message = "You’ve used your free inspections. Paid access is currently activated through BarrierCheck support.";
    if (window.confirm(message + "\n\nOpen support now?")) {
      topNavigate("/contact/");
    }
  };

  window.startStripeCheckout = function () {
    topNavigate("/contact/");
  };

  window.redirectToLogin = function (reason) {
    var query = reason ? "?" + String(reason).replace(/^\?/, "") : "";
    topNavigate("/app/login/" + query);
  };

  window.signOutCurrentUser = function () {
    if (!firebaseAuth) {
      topNavigate("/app/login/");
      return;
    }
    firebaseAuth.signOut().then(function () {
      topNavigate("/app/login/");
    });
  };

  window.startNewInspection = function () {
    if (startingInspection) return;

    if (!firebaseUser || !firebaseApproved || !firebaseDataLoaded) {
      alert("Please sign in first so the inspection can be saved online.");
      return;
    }

    if (!profileCompleted) {
      requireProfileBeforeAppUse();
      return;
    }

    if (!firebaseBillingActive) {
      alert(firebaseBillingMessage || "A current trial or subscription is required before inspections can be started.");
      return;
    }

    startingInspection = true;
    var consume = hasPaidSubscription(currentUserProfile)
      ? Promise.resolve({ consumed: false })
      : window.incrementFreeInspectionUsageIfNeeded();

    consume.then(function () {
      clearFormForNewInspection();

      currentInspectionId = generateId();
      inspectionStarted = true;
      currentInspectorSnapshot = createInspectorSnapshotFromProfile();

      qs("#inspectionNumber").value = generateInspectionNumber();
      qs("#inspectionDate").value = getTodayDateString();
      prefillInspectionFromProfile();

      addFenceSection();
      addClimbabilitySection();
      addGateSection();

      saveCurrentInspection(false);
      renderInspectionList();
      showTab("details");
    }).catch(function (error) {
      console.error(error);
      var code = String(error && error.code || "");
      if (code.indexOf("resource-exhausted") !== -1 || code.indexOf("failed-precondition") !== -1) {
        window.showSubscribePrompt();
        return;
      }
      alert("Could not start a new inspection: " + (error && error.message ? error.message : "Unknown error"));
    }).then(function () {
      startingInspection = false;
    });
  };
})();