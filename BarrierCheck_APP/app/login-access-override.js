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
      password: document.getElementById("signupPassword") ? document.getElementById("signupPassword").value : "",
      phone: val("signupPhone"),
      licenceNumber: val("signupLicence"),
      businessName: val("signupBusiness")
    };
  }

  function isProfileComplete(profile) {
    return !!(profile && profile.inspectorName && profile.licenceNumber && profile.inspectorEmail && profile.inspectorPhone && profile.businessName && profile.profileIcon && profile.profileIcon.type);
  }

  function hasRequiredSignupFields(data, needsPassword) {
    if (!data.fullName || !data.email || !data.phone || !data.licenceNumber || !data.businessName) {
      setLoginStatus("Enter your name, email, phone, licence number and business name before creating an account.", true);
      return false;
    }
    if (needsPassword && (!data.password || data.password.length < 6)) {
      setLoginStatus("Password must be at least 6 characters.", true);
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

  window.createAccountWithEmail = function () {
    if (!loginAuth) return;
    var signup = getSignupData();
    if (!hasRequiredSignupFields(signup, true)) return;

    setPendingVisible(false);
    setLoginStatus("Creating your inspector account...", false);

    loginAuth
      .createUserWithEmailAndPassword(signup.email, signup.password)
      .then(function (credential) {
        if (credential.user && signup.fullName) {
          return credential.user.updateProfile({ displayName: signup.fullName }).catch(function () {}).then(function () { return credential.user; });
        }
        return credential.user;
      })
      .then(function (user) {
        return window.createPendingProfile(user);
      })
      .then(function () {
        setLoginStatus("Account created. Opening your free trial...", false);
        window.goToApp();
      })
      .catch(function (error) {
        console.error(error);
        setLoginStatus("Could not create account: " + error.message, true);
      });
  };

  window.signInWithGoogleOnly = function () {
    if (!loginAuth || !window.firebase) return;
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    setPendingVisible(false);
    setLoginStatus("Opening Google sign-in...", false);
    loginAuth.signInWithPopup(provider).catch(function (error) {
      console.error(error);
      setLoginStatus("Google sign-in failed: " + error.message, true);
    });
  };

  window.createAccountWithGoogle = function () {
    if (!loginAuth || !window.firebase) return;
    var signup = getSignupData();
    if (!hasRequiredSignupFields(signup, false)) return;
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    setPendingVisible(false);
    setLoginStatus("Opening Google sign-up...", false);
    loginAuth
      .signInWithPopup(provider)
      .then(function (result) {
        return window.createPendingProfile(result.user);
      })
      .then(function () {
        setLoginStatus("Account created. Opening your free trial...", false);
        window.goToApp();
      })
      .catch(function (error) {
        console.error(error);
        setLoginStatus("Google sign-up failed: " + error.message, true);
      });
  };

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

  document.addEventListener("DOMContentLoaded", function () {
    var createBtn = document.getElementById("createAccountBtn");
    if (createBtn) {
      createBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.createAccountWithEmail();
      }, true);
    }

    var googleSignInBtn = document.getElementById("googleSignInBtn");
    if (googleSignInBtn) {
      googleSignInBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.signInWithGoogleOnly();
      }, true);
    }

    var googleCreateBtn = document.getElementById("googleCreateBtn");
    if (googleCreateBtn) {
      googleCreateBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.createAccountWithGoogle();
      }, true);
    }
  });
})();
