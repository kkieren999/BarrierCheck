// BarrierCheck modal auth flow: Google + phone.
(function () {
  var authMode = "signin";
  var activeConfirmation = null;
  var activePhone = "";
  var recaptchaVerifier = null;
  var recaptchaWidgetId = null;

  function clean(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function show(id, visible) {
    var el = byId(id);
    if (el) el.hidden = !visible;
  }

  function text(id, value) {
    var el = byId(id);
    if (el) el.textContent = value || "";
  }

  function setModalTitle(title, subtitle) {
    text("authModalTitle", title);
    text("authModalSubtitle", subtitle);
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

  function displayPhone(phone) {
    phone = normalizeAuPhone(phone);
    if (phone.indexOf("+61") === 0 && phone.length >= 12) {
      return "+61 " + phone.slice(3, 6) + " " + phone.slice(6, 9) + " " + phone.slice(9);
    }
    return phone || "your phone";
  }

  function getPhoneInput() {
    var el = byId("phoneModalNumber");
    return normalizeAuPhone(el ? el.value : "");
  }

  function validateCreateDetails() {
    var data = getSignupData();
    if (!data.fullName || !data.email || !data.phone || !data.licenceNumber || !data.businessName) {
      setLoginStatus("Enter your name, email, phone, licence number and business name before continuing.", true);
      return false;
    }
    return true;
  }

  function setView(view) {
    show("authOptionsView", view === "options");
    show("createDetailsView", view === "details");
    show("phoneNumberView", view === "phone");
    show("phoneCodeView", view === "code");
    show("authModalBackBtn", view !== "options" || authMode === "create");

    if (view === "details") {
      setModalTitle("Create inspector account", "Add your details first, then choose Google or phone to verify your account.");
      var nameInput = byId("signupName");
      if (nameInput) setTimeout(function () { nameInput.focus(); }, 30);
    }

    if (view === "options") {
      setModalTitle(authMode === "create" ? "Choose verification" : "Sign in", authMode === "create" ? "Continue with Google or verify your phone number." : "Choose how you want to sign in to BarrierCheck.");
    }

    if (view === "phone") {
      setModalTitle("What’s your number?", "");
      var phoneInput = byId("phoneModalNumber");
      if (phoneInput && authMode === "create" && !phoneInput.value) phoneInput.value = getSignupData().phone;
      if (phoneInput) setTimeout(function () { phoneInput.focus(); }, 30);
      updatePhoneNextState();
    }

    if (view === "code") {
      setModalTitle("Enter your code", "");
      clearCodeBoxes();
      var firstCodeBox = document.querySelector("#phoneCodeBoxes .code-box");
      if (firstCodeBox) setTimeout(function () { firstCodeBox.focus(); }, 30);
    }
  }

  function openModal(mode) {
    authMode = mode === "create" ? "create" : "signin";
    activeConfirmation = null;
    activePhone = "";
    var phoneInput = byId("phoneModalNumber");
    if (phoneInput) phoneInput.value = "";
    clearCodeBoxes();
    show("authModalBackdrop", true);
    setView(authMode === "create" ? "details" : "options");
    setLoginStatus(authMode === "create" ? "Create an account to start your free trial." : "Sign in to continue.", false);
  }

  function closeModal() {
    show("authModalBackdrop", false);
  }

  function goBack() {
    var codeView = byId("phoneCodeView");
    var phoneView = byId("phoneNumberView");
    var optionsView = byId("authOptionsView");
    if (codeView && !codeView.hidden) return setView("phone");
    if (phoneView && !phoneView.hidden) return setView("options");
    if (optionsView && !optionsView.hidden && authMode === "create") return setView("details");
    setView("options");
  }

  function isProfileComplete(profile) {
    return !!(profile && profile.inspectorName && profile.licenceNumber && profile.inspectorEmail && profile.inspectorPhone && profile.businessName && profile.profileIcon && profile.profileIcon.type);
  }

  window.buildInitialInspectorProfile = function (user) {
    var signup = getSignupData();
    var email = signup.email || (user && user.email) || "";
    var name = signup.fullName || (user && user.displayName) || "";
    var phone = normalizeAuPhone(signup.phone || activePhone || (user && user.phoneNumber) || "");
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

    if (typeof buildLegalAcceptanceData === "function") {
      Object.assign(profileData, buildLegalAcceptanceData());
    }

    return getUserProfileRef(user).set(profileData, { merge: true });
  };

  function continueWithGoogle() {
    if (!loginAuth || !window.firebase) return;
    if (authMode === "create" && !validateCreateDetails()) return;
    setPendingVisible(false);
    setLoginStatus("Opening Google...", false);
    loginAuth
      .signInWithPopup(makeGoogleProvider())
      .then(function (result) {
        if (authMode === "create") return window.createPendingProfile(result.user);
        return null;
      })
      .then(function () {
        if (authMode === "create") setLoginStatus("Account created. Opening BarrierCheck...", false);
      })
      .catch(function (error) {
        console.error(error);
        setLoginStatus("Google sign-in failed: " + error.message, true);
      });
  }

  function continueWithPhone() {
    if (authMode === "create" && !validateCreateDetails()) return;
    setView("phone");
  }

  function updatePhoneNextState() {
    var phone = getPhoneInput();
    var btn = byId("phoneModalSendBtn");
    if (btn) btn.disabled = phone.length < 10;
  }

  function sendPhoneCode() {
    if (!loginAuth || !window.firebase) return;
    var phone = getPhoneInput();
    if (!phone) {
      setLoginStatus("Enter your phone number first.", true);
      return;
    }
    activePhone = phone;
    setPendingVisible(false);
    setLoginStatus("Sending SMS code...", false);
    ensureRecaptcha()
      .then(function (verifier) { return loginAuth.signInWithPhoneNumber(phone, verifier); })
      .then(function (confirmation) {
        activeConfirmation = confirmation;
        text("phoneCodeSentText", "We sent a one-time passcode to " + displayPhone(phone) + ". This code will expire shortly.");
        setView("code");
        setLoginStatus("SMS code sent.", false);
      })
      .catch(function (error) {
        console.error(error);
        resetRecaptcha();
        setView("phone");
        setLoginStatus("Could not send SMS code: " + error.message, true);
      });
  }

  function readCode() {
    var boxes = Array.prototype.slice.call(document.querySelectorAll("#phoneCodeBoxes .code-box"));
    var code = boxes.map(function (box) { return clean(box.value).replace(/\D/g, "").slice(0, 1); }).join("");
    var hidden = byId("phoneModalCode");
    if (hidden) hidden.value = code;
    var verify = byId("phoneModalVerifyBtn");
    if (verify) verify.disabled = code.length !== 6;
    return code;
  }

  function clearCodeBoxes() {
    Array.prototype.slice.call(document.querySelectorAll("#phoneCodeBoxes .code-box")).forEach(function (box) { box.value = ""; });
    var hidden = byId("phoneModalCode");
    if (hidden) hidden.value = "";
    var verify = byId("phoneModalVerifyBtn");
    if (verify) verify.disabled = true;
  }

  function verifyPhoneCode() {
    var code = readCode();
    if (!activeConfirmation) {
      setLoginStatus("Send an SMS code first.", true);
      return;
    }
    if (code.length !== 6) {
      setLoginStatus("Enter the 6-digit SMS code.", true);
      return;
    }
    setLoginStatus(authMode === "create" ? "Creating your account..." : "Signing in...", false);
    activeConfirmation.confirm(code)
      .then(function (result) {
        if (authMode === "create") return window.createPendingProfile(result.user);
        return null;
      })
      .then(function () {
        if (authMode === "create") setLoginStatus("Account created. Opening BarrierCheck...", false);
      })
      .catch(function (error) {
        console.error(error);
        setLoginStatus("Phone verification failed: " + error.message, true);
      });
  }

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

  function bindCodeBoxes() {
    var boxes = Array.prototype.slice.call(document.querySelectorAll("#phoneCodeBoxes .code-box"));
    boxes.forEach(function (box, index) {
      box.addEventListener("input", function () {
        box.value = clean(box.value).replace(/\D/g, "").slice(0, 1);
        if (box.value && boxes[index + 1]) boxes[index + 1].focus();
        readCode();
      });
      box.addEventListener("keydown", function (event) {
        if (event.key === "Backspace" && !box.value && boxes[index - 1]) boxes[index - 1].focus();
      });
      box.addEventListener("paste", function (event) {
        event.preventDefault();
        var paste = (event.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
        paste.split("").forEach(function (digit, digitIndex) {
          if (boxes[digitIndex]) boxes[digitIndex].value = digit;
        });
        readCode();
        if (boxes[Math.min(paste.length, 5)]) boxes[Math.min(paste.length, 5)].focus();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindButton("landingCreateBtn", function () { openModal("create"); });
    bindButton("landingSignInBtn", function () { openModal("signin"); });
    bindButton("authModalCloseBtn", closeModal);
    bindButton("authModalBackBtn", goBack);
    bindButton("googleModalBtn", continueWithGoogle);
    bindButton("phoneModalStartBtn", continueWithPhone);
    bindButton("createDetailsNextBtn", function () { if (validateCreateDetails()) setView("options"); });
    bindButton("phoneModalSendBtn", sendPhoneCode);
    bindButton("phoneModalVerifyBtn", verifyPhoneCode);
    bindButton("phoneModalResendBtn", sendPhoneCode);
    bindButton("phoneModalChangeBtn", function () { setView("phone"); });

    var phoneInput = byId("phoneModalNumber");
    if (phoneInput) {
      phoneInput.addEventListener("input", updatePhoneNextState);
      phoneInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !byId("phoneModalSendBtn").disabled) sendPhoneCode();
      });
    }

    bindCodeBoxes();
    setView("options");
  });
})();
