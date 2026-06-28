// Login access patch for BarrierCheck free-trial signup flow.
(function () {
  function clean(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function defaultProfileIcon(user) {
    var googleUrl = "";
    if (user && user.photoURL) googleUrl = user.photoURL;
    if (googleUrl) return { type: "google", photoURL: googleUrl, avatarId: "" };
    return { type: "default", photoURL: "", avatarId: "default" };
  }

  function getSignupData() {
    function val(id) {
      var el = document.getElementById(id);
      return el ? clean(el.value) : "";
    }
    return {
      fullName: val("signupName"),
      email: val("signupEmail") || val("loginEmail"),
      phone: val("signupPhone"),
      licenceNumber: val("signupLicence"),
      businessName: val("signupBusiness")
    };
  }

  function isProfileComplete(profile) {
    return !!(profile && profile.inspectorName && profile.licenceNumber && profile.inspectorEmail && profile.inspectorPhone && profile.businessName && profile.profileIcon && profile.profileIcon.type);
  }

  function hasRequiredSignupFields(data) {
    if (!data.fullName || !data.email || !data.phone || !data.licenceNumber || !data.businessName) {
      setLoginStatus("Enter your name, email, phone, licence number and business name before creating an account.", true);
      return false;
    }
    if (typeof requireLegalTermsForNewAccount === "function" && !requireLegalTermsForNewAccount()) return false;
    return true;
  }

  window.buildInitialInspectorProfile = function (user) {
    var signup = getSignupData();
    var email = signup.email || (user && user.email) || "";
    var name = signup.fullName || (user && user.displayName) || "";
    var phone = signup.phone || "";
    return {
      inspectorName: name,
      licenceNumber: signup.licenceNumber || "",
      inspectorEmail: email,
      inspectorPhone: phone,
      businessName: signup.businessName || "",
      businessAddress: "",
      businessAbn: "",
      businessWebsite: "",
      reportEmail: email,
      reportPhone: phone,
      reportLogoUrl: "",
      reportFooterText: "",
      inspectionNumberPrefix: "BC",
      profileIcon: defaultProfileIcon(user)
    };
  };

  function canEnterApp(profile) {
    if (!profile) return true;
    var values = [profile.role, profile.billingAccess, profile.verificationStatus, profile.subscriptionStatus].map(function (value) {
      return clean(value).toLowerCase();
    });
    return values.indexOf("rejected") === -1 && values.indexOf("suspended") === -1 && values.indexOf("blocked") === -1;
  }

  function setTrialAccess(profileData) {
    if (!profileData) return profileData;
    if (!profileData.billingAccess || profileData.billingAccess === "pending_verification") profileData.billingAccess = "free_inspections";
    if (!profileData.subscriptionStatus || profileData.subscriptionStatus === "pending_verification") profileData.subscriptionStatus = "free_inspections";
    if (profileData.freeInspectionLimit === undefined || profileData.freeInspectionLimit === null) profileData.freeInspectionLimit = 3;
    if (profileData.freeInspectionsUsed === undefined || profileData.freeInspectionsUsed === null) profileData.freeInspectionsUsed = 0;
    return profileData;
  }

  function makeProvider(kind) {
    if (kind === "apple") {
      var appleProvider = new firebase.auth.OAuthProvider("apple.com");
      appleProvider.addScope("email");
      appleProvider.addScope("name");
      return appleProvider;
    }
    var googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
    return googleProvider;
  }

  function providerLabel(kind) {
    return kind === "apple" ? "Apple" : "Google";
  }

  window.createPendingProfile = function (user) {
    var providerIds = (user.providerData || []).map(function (provider) { return provider.providerId; });
    var inspectorProfile = window.buildInitialInspectorProfile(user);
    var profileData = setTrialAccess({
      email: user.email || inspectorProfile.inspectorEmail || "",
      displayName: inspectorProfile.inspectorName || user.displayName || "",
      approved: false,
      admin: false,
      role: "pending",
      verificationStatus: "pending",
      verificationMethod: "manual_qbcc_register",
      freeInspectionLimit: 3,
      freeInspectionsUsed: 0,
      providerIds: providerIds,
      inspectorProfile: inspectorProfile,
      profileCompleted: isProfileComplete(inspectorProfile),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      freeInspectionsStartedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (typeof hasAcceptedLegalTerms === "function" && hasAcceptedLegalTerms()) {
      Object.assign(profileData, buildLegalAcceptanceData());
    }

    return getUserProfileRef(user).set(profileData, { merge: true });
  };

  function signInWithProvider(kind) {
    if (!loginAuth || !window.firebase) return;
    setPendingVisible(false);
    setLoginStatus("Opening " + providerLabel(kind) + " sign-in...", false);
    loginAuth.signInWithPopup(makeProvider(kind)).catch(function (error) {
      console.error(error);
      setLoginStatus(providerLabel(kind) + " sign-in failed: " + error.message, true);
    });
  }

  function createWithProvider(kind) {
    if (!loginAuth || !window.firebase) return;
    var signup = getSignupData();
    if (!hasRequiredSignupFields(signup)) return;
    setPendingVisible(false);
    setLoginStatus("Opening " + providerLabel(kind) + " sign-up...", false);
    loginAuth
      .signInWithPopup(makeProvider(kind))
      .then(function (result) {
        return window.createPendingProfile(result.user);
      })
      .then(function () {
        setLoginStatus("Account created. Opening your free trial...", false);
        window.goToApp();
      })
      .catch(function (error) {
        console.error(error);
        setLoginStatus(providerLabel(kind) + " sign-up failed: " + error.message, true);
      });
  }

  window.signInWithGoogleOnly = function () { signInWithProvider("google"); };
  window.signInWithAppleOnly = function () { signInWithProvider("apple"); };
  window.createAccountWithGoogle = function () { createWithProvider("google"); };
  window.createAccountWithApple = function () { createWithProvider("apple"); };

  window.goToApp = function () {
    window.location.replace("/app/");
  };

  window.checkApprovalAndContinue = function (user) {
    if (!user || !window.loginDb) return;

    authStateBusy = true;
    setPendingVisible(false);
    setLoginStatus("Checking your account...", false);

    ensureUserProfile(user)
      .then(function (profile) {
        authStateBusy = false;
        profile = setTrialAccess(profile || {});
        if (canEnterApp(profile)) {
          setLoginStatus("Opening BarrierCheck...", false);
          window.goToApp();
          return;
        }

        setPendingVisible(true);
        setLoginStatus("This account is not currently active. Please contact BarrierCheck support.", true);
      })
      .catch(function (error) {
        authStateBusy = false;
        console.error(error);
        setLoginStatus("Could not check account: " + error.message, true);
      });
  };

  function bindButton(id, handler) {
    var button = document.getElementById(id);
    if (!button) return;
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }, true);
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindButton("googleSignInBtn", window.signInWithGoogleOnly);
    bindButton("appleSignInBtn", window.signInWithAppleOnly);
    bindButton("googleCreateBtn", window.createAccountWithGoogle);
    bindButton("appleCreateBtn", window.createAccountWithApple);
  });
})();
