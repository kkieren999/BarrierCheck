// Login access patch for BarrierCheck Google + modern phone free-trial signup flow.
(function () {
  var signInConfirmation = null;
  var createConfirmation = null;
  var recaptchaVerifier = null;
  var recaptchaWidgetId = null;
  var lastSignInPhone = "";
  var lastCreatePhone = "";

  function clean(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function hide(id, shouldHide) {
    var el = byId(id);
    if (el) el.hidden = !!shouldHide;
  }

  function setText(id, text) {
    var el = byId(id);
    if (el) el.textContent = text || "";
  }

  function defaultProfileIcon(user) {
    var googleUrl = "";
    if (user && user.photoURL) googleUrl = user.photoURL;
    if (googleUrl) return { type: "google", photoURL: googleUrl, avatarId: "" };
    return { type: "default", photoURL: "", avatarId: "default" };
  }

  function getSignupData() {
    function val(id) {
      var el = byId(id);
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

  function normalizeAuPhone(value) {
    var phone = clean(value).replace(/[\s\-()]/g, "");
    if (!phone) return "";
    if (phone.indexOf("+") === 0) return phone;
    if (phone.indexOf("04") === 0) return "+61" + phone.slice(1);
    if (phone.indexOf("4") === 0 && phone.length === 9) return "+61" + phone;
    return phone;
  }

  function phoneInputValue(id) {
    var el = byId(id);
    return normalizeAuPhone(el ? el.value : "");
  }

  function formatPhoneForDisplay(phone) {
    phone = normalizeAuPhone(phone);
    if (phone.indexOf("+61") === 0 && phone.length >= 12) {
      return "+61 " + phone.slice(3, 6) + " " + phone.slice(6, 9) + " " + phone.slice(9);
    }
    return phone || "your phone";
  }

  function showSignInPhoneStep(step) {
    hide("phoneSignInStartBtn", step !== "start");
    hide("phoneSignInRequestStep", step !== "request");
    hide("phoneSignInCodeStep", step !== "code");
    if (step === "request") {
      var phoneInput = byId("phoneSignInNumber");
      if (phoneInput) setTimeout(function () { phoneInput.focus(); }, 30);
    }
    if (step === "code") {
      var codeInput = byId("phoneSignInCode");
      if (codeInput) setTimeout(function () { codeInput.focus(); }, 30);
    }
  }

  function showCreatePhoneStep(step) {
    hide("phoneCreateStartBtn", step !== "start");
    hide("phoneCreateCodeStep", step !== "code");
    if (step === "code") {
      var codeInput = byId("phoneCreateCode");
      if (codeInput) setTimeout(function () { codeInput.focus(); }, 30);
    }
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
    var phone = normalizeAuPhone(signup.phone || (user && user.phoneNumber) || "");
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

  function makeGoogleProvider() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return provider;
  }

  function ensureRecaptcha() {
    if (recaptchaVerifier) return Promise.resolve(recaptchaVerifier);
    var container = byId("phoneRecaptcha");
    if (!container) return Promise.reject(new Error("Phone verification container is missing."));
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier("phoneRecaptcha", { size: "invisible" });
    return recaptchaVerifier.render().then(function (widgetId) {
      recaptchaWidgetId = widgetId;
      return recaptchaVerifier;
    });
  }

  function resetRecaptcha() {
    if (window.grecaptcha && recaptchaWidgetId !== null) {
      try { window.grecaptcha.reset(recaptchaWidgetId); } catch (error) {}
    }
  }

  window.createPendingProfile = function (user) {
    var providerIds = (user.providerData || []).map(function (provider) { return provider.providerId; });
    var inspectorProfile = window.buildInitialInspectorProfile(user);
    var profileData = setTrialAccess({
      email: user.email || inspectorProfile.inspectorEmail || "",
      displayName: inspectorProfile.inspectorName || user.displayName || "",
      phoneNumber: user.phoneNumber || inspectorProfile.inspectorPhone || "",
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

  window.signInWithGoogleOnly = function () {
    if (!loginAuth || !window.firebase) return;
    setPendingVisible(false);
    setLoginStatus("Opening Google sign-in...", false);
    loginAuth.signInWithPopup(makeGoogleProvider()).catch(function (error) {
      console.error(error);
      setLoginStatus("Google sign-in failed: " + error.message, true);
    });
  };

  window.createAccountWithGoogle = function () {
    if (!loginAuth || !window.firebase) return;
    var signup = getSignupData();
    if (!hasRequiredSignupFields(signup)) return;
    setPendingVisible(false);
    setLoginStatus("Opening Google sign-up...", false);
    loginAuth
      .signInWithPopup(makeGoogleProvider())
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

  window.sendPhoneSignInCode = function () {
    if (!loginAuth || !window.firebase) return;
    var phone = phoneInputValue("phoneSignInNumber");
    if (!phone) {
      setLoginStatus("Enter your phone number first.", true);
      return;
    }
    lastSignInPhone = phone;
    setPendingVisible(false);
    setLoginStatus("Sending SMS code...", false);
    ensureRecaptcha()
      .then(function (verifier) { return loginAuth.signInWithPhoneNumber(phone, verifier); })
      .then(function (confirmation) {
        signInConfirmation = confirmation;
        setText("phoneSignInDisplay", formatPhoneForDisplay(phone));
        showSignInPhoneStep("code");
        setLoginStatus("SMS code sent.", false);
      })
      .catch(function (error) {
        console.error(error);
        resetRecaptcha();
        showSignInPhoneStep("request");
        setLoginStatus("Could not send SMS code: " + error.message, true);
      });
  };

  window.verifyPhoneSignInCode = function () {
    var codeEl = byId("phoneSignInCode");
    var code = clean(codeEl ? codeEl.value : "");
    if (!signInConfirmation) {
      setLoginStatus("Send an SMS code first.", true);
      return;
    }
    if (!code) {
      setLoginStatus("Enter the SMS code.", true);
      return;
    }
    setLoginStatus("Verifying phone code...", false);
    signInConfirmation.confirm(code).catch(function (error) {
      console.error(error);
      setLoginStatus("Phone sign-in failed: " + error.message, true);
    });
  };

  window.sendPhoneCreateCode = function () {
    if (!loginAuth || !window.firebase) return;
    var signup = getSignupData();
    if (!hasRequiredSignupFields(signup)) return;
    var phone = normalizeAuPhone(signup.phone);
    if (!phone) {
      setLoginStatus("Enter your phone number first.", true);
      return;
    }
    lastCreatePhone = phone;
    setPendingVisible(false);
    setLoginStatus("Sending SMS code...", false);
    ensureRecaptcha()
      .then(function (verifier) { return loginAuth.signInWithPhoneNumber(phone, verifier); })
      .then(function (confirmation) {
        createConfirmation = confirmation;
        setText("phoneCreateDisplay", formatPhoneForDisplay(phone));
        showCreatePhoneStep("code");
        setLoginStatus("SMS code sent.", false);
      })
      .catch(function (error) {
        console.error(error);
        resetRecaptcha();
        showCreatePhoneStep("start");
        setLoginStatus("Could not send SMS code: " + error.message, true);
      });
  };

  window.verifyPhoneCreateCode = function () {
    var codeEl = byId("phoneCreateCode");
    var code = clean(codeEl ? codeEl.value : "");
    if (!createConfirmation) {
      setLoginStatus("Send an SMS code first.", true);
      return;
    }
    if (!code) {
      setLoginStatus("Enter the SMS code.", true);
      return;
    }
    setLoginStatus("Verifying phone code and creating account...", false);
    createConfirmation.confirm(code)
      .then(function (result) {
        return window.createPendingProfile(result.user);
      })
      .then(function () {
        setLoginStatus("Account created. Opening your free trial...", false);
        window.goToApp();
      })
      .catch(function (error) {
        console.error(error);
        setLoginStatus("Phone account creation failed: " + error.message, true);
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

  function bindButton(id, handler) {
    var button = byId(id);
    if (!button) return;
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }, true);
  }

  document.addEventListener("DOMContentLoaded", function () {
    showSignInPhoneStep("start");
    showCreatePhoneStep("start");

    bindButton("googleSignInBtn", window.signInWithGoogleOnly);
    bindButton("googleCreateBtn", window.createAccountWithGoogle);

    bindButton("phoneSignInStartBtn", function () { showSignInPhoneStep("request"); });
    bindButton("phoneSignInBackBtn", function () { showSignInPhoneStep("start"); });
    bindButton("phoneSignInSendBtn", window.sendPhoneSignInCode);
    bindButton("phoneSignInVerifyBtn", window.verifyPhoneSignInCode);
    bindButton("phoneSignInResendBtn", window.sendPhoneSignInCode);
    bindButton("phoneSignInChangeBtn", function () { showSignInPhoneStep("request"); });

    bindButton("phoneCreateStartBtn", window.sendPhoneCreateCode);
    bindButton("phoneCreateResendBtn", window.sendPhoneCreateCode);
    bindButton("phoneCreateVerifyBtn", window.verifyPhoneCreateCode);
    bindButton("phoneCreateChangeBtn", function () {
      showCreatePhoneStep("start");
      var phone = byId("signupPhone");
      if (phone) phone.focus();
    });
  });
})();
