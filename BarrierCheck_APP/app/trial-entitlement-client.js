// Calls the server-side free-trial entitlement check before creating a BarrierCheck profile.
(function () {
  var FUNCTIONS_REGION = "australia-southeast1";
  var FREE_TRIAL_POLICY_VERSION = "2026-06-free-trial-v1";

  function clean(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function value(id) {
    var el = byId(id);
    return el ? clean(el.value) : "";
  }

  function normalizeAuPhone(value) {
    var phone = clean(value).replace(/[\s\-()]/g, "");
    if (!phone) return "";
    if (phone.indexOf("+") === 0) return phone;
    if (phone.indexOf("04") === 0) return "+61" + phone.slice(1);
    if (phone.indexOf("4") === 0 && phone.length === 9) return "+61" + phone;
    return phone;
  }

  function getSignupData(user) {
    return {
      fullName: value("signupName") || (user && user.displayName) || "",
      email: value("signupEmail") || (user && user.email) || "",
      phone: normalizeAuPhone(value("signupPhone") || (user && user.phoneNumber) || ""),
      licenceNumber: value("signupLicence"),
      businessName: value("signupBusiness")
    };
  }

  function validateSignupFields() {
    var form = byId("signupForm");
    if (window.BarrierCheckRequiredFields && form) {
      var fields = Array.prototype.slice.call(form.querySelectorAll("input[required], textarea[required], select[required], [data-required='true']"));
      if (fields.length && !window.BarrierCheckRequiredFields.validate(fields, true)) return false;
    }
    var data = getSignupData();
    return !!(data.fullName && data.email && data.phone && data.licenceNumber && data.businessName);
  }

  function loadFunctionsSdk() {
    if (window.firebase && firebase.functions) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-bc-functions-sdk="true"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.src = "https://www.gstatic.com/firebasejs/10.13.2/firebase-functions-compat.js";
      script.defer = true;
      script.dataset.bcFunctionsSdk = "true";
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Firebase Functions SDK could not load.")); };
      document.head.appendChild(script);
    });
  }

  function getFunctionsClient() {
    return loadFunctionsSdk().then(function () {
      if (firebase.app && typeof firebase.app().functions === "function") {
        return firebase.app().functions(FUNCTIONS_REGION);
      }
      if (typeof firebase.functions === "function") return firebase.functions();
      throw new Error("Firebase Functions is not available.");
    });
  }

  window.createPendingProfile = function (user) {
    if (!validateSignupFields()) {
      if (typeof setLoginStatus === "function") setLoginStatus("", false);
      return Promise.reject(new Error("Complete the required signup fields."));
    }

    var payload = getSignupData(user);
    payload.freeTrialPolicyVersion = FREE_TRIAL_POLICY_VERSION;

    if (typeof setLoginStatus === "function") setLoginStatus("Checking free-trial eligibility...", false);

    return getFunctionsClient()
      .then(function (functionsClient) {
        return functionsClient.httpsCallable("createAccountProfile")(payload);
      })
      .then(function (result) {
        var data = result && result.data ? result.data : {};
        if (typeof setLoginStatus === "function") {
          if (data.trialEntitlementCheckStatus === "already_used") {
            setLoginStatus("Account created. This inspector/licence has already used the free trial, so free inspections were not reset.", false);
          } else {
            setLoginStatus("Account created. Opening BarrierCheck...", false);
          }
        }
        return data;
      });
  };
})();
