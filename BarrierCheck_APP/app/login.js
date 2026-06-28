var FIREBASE_CONFIG = window.FIREBASE_CONFIG || {};
var loginAuth = null;
var loginDb = null;
var authStateBusy = false;
var LEGAL_TERMS_VERSION = "2026-06-16-v1";
var LEGAL_PRIVACY_VERSION = "2026-06-16-v1";
var LEGAL_REFUND_VERSION = "2026-06-16-v1";
var GENERIC_CREATE_DETAILS_ERROR = "Enter your name, email, phone, licence number and business name before continuing.";

function qs(selector) {
  return document.querySelector(selector);
}

function setLoginStatus(message, isError) {
  var el = qs("#loginStatus");
  if (!el) return;
  if (message === GENERIC_CREATE_DETAILS_ERROR) {
    el.textContent = "";
    el.classList.remove("error");
    return;
  }
  el.textContent = message || "";
  el.classList.toggle("error", !!isError);
}

function setPendingVisible(visible) {
  var box = qs("#pendingBox");
  if (box) box.hidden = !visible;
}

function hasAcceptedLegalTerms() {
  var checkbox = qs("#legalAcceptCheck");
  return !!(checkbox && checkbox.checked);
}

function wantsMarketingEmails() {
  var checkbox = qs("#marketingOptInCheck");
  return !!(checkbox && checkbox.checked);
}

function buildLegalAcceptanceData() {
  return {
    termsAcceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
    termsVersion: LEGAL_TERMS_VERSION,
    privacyVersion: LEGAL_PRIVACY_VERSION,
    refundPolicyVersion: LEGAL_REFUND_VERSION,
    marketingOptIn: wantsMarketingEmails(),
    marketingOptInUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

function requireLegalTermsForNewAccount() {
  if (hasAcceptedLegalTerms()) return true;
  setLoginStatus("Tick the Privacy, Terms and Refund Policy agreement before creating an account.", true);
  return false;
}

function goToApp() {
  window.location.replace("index.html");
}

function getUserProfileRef(user) {
  return loginDb.collection("users").doc(user.uid);
}

function getGooglePhotoUrl(user) {
  if (user && user.photoURL) return user.photoURL;
  var providers = user && user.providerData ? user.providerData : [];
  for (var i = 0; i < providers.length; i += 1) {
    if (providers[i].providerId === "google.com" && providers[i].photoURL) return providers[i].photoURL;
  }
  return "";
}

function buildInitialInspectorProfile(user) {
  var googleUrl = getGooglePhotoUrl(user);
  return {
    inspectorName: user && user.displayName ? user.displayName : "",
    licenceNumber: "",
    inspectorEmail: user && user.email ? user.email : "",
    inspectorPhone: user && user.phoneNumber ? user.phoneNumber : "",
    businessName: "",
    businessAddress: "",
    businessAbn: "",
    businessWebsite: "",
    reportEmail: user && user.email ? user.email : "",
    reportPhone: user && user.phoneNumber ? user.phoneNumber : "",
    reportLogoUrl: "",
    reportFooterText: "",
    inspectionNumberPrefix: "BC",
    profileIcon: googleUrl
      ? { type: "google", photoURL: googleUrl, avatarId: "" }
      : { type: "default", photoURL: "", avatarId: "default" }
  };
}

function createPendingProfile(user) {
  var providerIds = (user.providerData || []).map(function (provider) {
    return provider.providerId;
  });

  var profileData = {
    email: user.email || "",
    displayName: user.displayName || "",
    phoneNumber: user.phoneNumber || "",
    approved: false,
    role: "pending",
    verificationStatus: "pending",
    verificationMethod: "manual_qbcc_register",
    subscriptionStatus: "free_inspections",
    billingAccess: "free_inspections",
    freeInspectionLimit: 3,
    freeInspectionsUsed: 0,
    providerIds: providerIds,
    inspectorProfile: buildInitialInspectorProfile(user),
    profileCompleted: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    freeInspectionsStartedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (hasAcceptedLegalTerms()) {
    Object.assign(profileData, buildLegalAcceptanceData());
  }

  return getUserProfileRef(user).set(profileData, { merge: true });
}

function ensureUserProfile(user) {
  var ref = getUserProfileRef(user);
  return ref.get().then(function (doc) {
    if (doc.exists) {
      var data = doc.data() || {};
      if (!data.termsAcceptedAt && hasAcceptedLegalTerms()) {
        return ref.set(buildLegalAcceptanceData(), { merge: true }).then(function () {
          data.termsAcceptedAt = true;
          data.termsVersion = LEGAL_TERMS_VERSION;
          data.privacyVersion = LEGAL_PRIVACY_VERSION;
          data.refundPolicyVersion = LEGAL_REFUND_VERSION;
          data.marketingOptIn = wantsMarketingEmails();
          return data;
        });
      }
      return data;
    }

    return createPendingProfile(user).then(function () {
      return {
        email: user.email || "",
        displayName: user.displayName || "",
        phoneNumber: user.phoneNumber || "",
        approved: false,
        role: "pending",
        subscriptionStatus: "free_inspections",
        billingAccess: "free_inspections",
        inspectorProfile: buildInitialInspectorProfile(user),
        profileCompleted: false
      };
    });
  });
}

function checkApprovalAndContinue(user) {
  if (!user || !loginDb) return;
  authStateBusy = true;
  setPendingVisible(false);
  setLoginStatus("Checking account...", false);

  ensureUserProfile(user)
    .then(function () {
      authStateBusy = false;
      goToApp();
    })
    .catch(function (error) {
      authStateBusy = false;
      console.error(error);
      setLoginStatus("Could not check account: " + error.message, true);
    });
}

function signInWithEmail(event) {
  if (event) event.preventDefault();
  setLoginStatus("Email/password sign-in is not enabled for BarrierCheck. Use Google or phone.", true);
}

function createAccountWithEmail() {
  setLoginStatus("Email/password accounts are not enabled for BarrierCheck. Use Google or phone.", true);
}

function signInWithGoogle() {
  if (!loginAuth || !window.firebase) return;
  var provider = new firebase.auth.GoogleAuthProvider();
  setPendingVisible(false);
  setLoginStatus("Opening Google sign-in...", false);
  loginAuth.signInWithPopup(provider).catch(function (error) {
    console.error(error);
    setLoginStatus("Google sign-in failed: " + error.message, true);
  });
}

function signOutPendingUser() {
  if (!loginAuth) return;
  loginAuth.signOut().then(function () {
    setPendingVisible(false);
    setLoginStatus("Signed out. Sign in to continue.", false);
  });
}

function getLoginQueryFlag(name) {
  try {
    return new URLSearchParams(window.location.search || "").has(name);
  } catch (error) {
    return false;
  }
}

function bindIfPresent(selector, eventName, handler, useCapture) {
  var el = qs(selector);
  if (el) el.addEventListener(eventName, handler, !!useCapture);
}

function injectRequiredFieldStyles() {
  if (document.getElementById("requiredFieldValidationStyles")) return;
  var style = document.createElement("style");
  style.id = "requiredFieldValidationStyles";
  style.textContent = [
    "label.required-missing{color:#d93025!important;}",
    ".required-inline-note{color:#d93025!important;font-weight:900;margin-left:.35em;}",
    ".required-missing-input{border-color:#d93025!important;box-shadow:0 0 0 3px rgba(217,48,37,.12)!important;}",
    "label.required-missing input,label.required-missing textarea,label.required-missing select{color:#102033!important;}",
    "label.required-missing input::placeholder,label.required-missing textarea::placeholder{color:#9aa6b8!important;}"
  ].join("\n");
  document.head.appendChild(style);
}

function getRequiredFieldLabel(field) {
  if (!field) return null;
  if (field.id) {
    var explicit = document.querySelector('label[for="' + field.id + '"]');
    if (explicit) return explicit;
  }
  return field.closest ? field.closest("label") : null;
}

function isRequiredFieldFilled(field) {
  if (!field || field.disabled || field.hidden || field.type === "hidden") return true;
  if (field.type === "checkbox" || field.type === "radio") return !!field.checked;
  return String(field.value || "").trim().length > 0;
}

function markRequiredField(field, missing) {
  var label = getRequiredFieldLabel(field);
  if (!field) return;
  field.classList.toggle("required-missing-input", !!missing);
  field.setAttribute("aria-invalid", missing ? "true" : "false");

  if (label) {
    label.classList.toggle("required-missing", !!missing);
    var note = label.querySelector(".required-inline-note");
    if (missing && !note) {
      note = document.createElement("span");
      note.className = "required-inline-note";
      note.textContent = "* required";
      label.insertBefore(note, label.firstElementChild || null);
    }
    if (!missing && note) note.remove();
  }
}

function validateRequiredFields(fields, focusFirst) {
  var firstMissing = null;
  fields.forEach(function (field) {
    var missing = !isRequiredFieldFilled(field);
    markRequiredField(field, missing);
    if (missing && !firstMissing) firstMissing = field;
  });
  if (firstMissing && focusFirst) setTimeout(function () { firstMissing.focus(); }, 20);
  return !firstMissing;
}

function getCreateDetailsRequiredFields() {
  var config = [
    ["signupName", "Full name"],
    ["signupEmail", "Email address"],
    ["signupPhone", "Phone number"],
    ["signupLicence", "QBCC / pool safety inspector licence"],
    ["signupBusiness", "Business name"]
  ];
  return config.map(function (item) {
    var field = document.getElementById(item[0]);
    if (field) {
      field.required = true;
      field.dataset.requiredLabel = item[1];
    }
    return field;
  }).filter(Boolean);
}

function validateCreateDetailsFields() {
  var ok = validateRequiredFields(getCreateDetailsRequiredFields(), true);
  setLoginStatus("", false);
  return ok;
}

function installRequiredFieldValidation() {
  injectRequiredFieldStyles();
  var signupForm = qs("#signupForm");
  if (signupForm) signupForm.dataset.validateRequired = "true";
  getCreateDetailsRequiredFields();

  document.addEventListener("input", function (event) {
    var field = event.target;
    if (!field || !field.matches || !field.matches("input, textarea, select")) return;
    if (field.required || field.dataset.required === "true") {
      markRequiredField(field, !isRequiredFieldFilled(field));
      setLoginStatus("", false);
    }
  }, true);

  document.addEventListener("blur", function (event) {
    var field = event.target;
    if (!field || !field.matches || !field.matches("input, textarea, select")) return;
    if (field.required || field.dataset.required === "true") {
      markRequiredField(field, !isRequiredFieldFilled(field));
    }
  }, true);

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.matches || !form.matches("form[data-validate-required='true']")) return;
    var fields = Array.prototype.slice.call(form.querySelectorAll("input[required], textarea[required], select[required], [data-required='true']"));
    if (!validateRequiredFields(fields, true)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setLoginStatus("", false);
    }
  }, true);

  bindIfPresent("#createDetailsNextBtn", "click", function (event) {
    if (!validateCreateDetailsFields()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

window.BarrierCheckRequiredFields = {
  validate: validateRequiredFields,
  mark: markRequiredField,
  install: installRequiredFieldValidation
};

function initLogin() {
  installRequiredFieldValidation();

  if (!window.firebase || !window.firebase.initializeApp) {
    setLoginStatus("Firebase scripts could not load. Try opening the app from a hosted site or local server.", true);
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    loginAuth = firebase.auth();
    loginDb = firebase.firestore();

    loginAuth.onAuthStateChanged(function (user) {
      if (user) {
        checkApprovalAndContinue(user);
      } else if (!authStateBusy) {
        setPendingVisible(false);
        setLoginStatus(getLoginQueryFlag("accountDeleted") ? "Your BarrierCheck account has been deleted." : "Sign in or create an account to continue.", false);
      }
    });

    bindIfPresent("#emailLoginForm", "submit", signInWithEmail);
    bindIfPresent("#createAccountBtn", "click", createAccountWithEmail);
    bindIfPresent("#googleSignInBtn", "click", signInWithGoogle);
    bindIfPresent("#pendingSignOutBtn", "click", signOutPendingUser);
    setLoginStatus(getLoginQueryFlag("accountDeleted") ? "Your BarrierCheck account has been deleted." : "Sign in or create an account to continue.", false);
  } catch (error) {
    console.error(error);
    setLoginStatus("Firebase setup failed: " + error.message, true);
  }
}

document.addEventListener("DOMContentLoaded", initLogin);
