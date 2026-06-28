// Login access patch for owner/admin accounts.
// This also ensures new accounts get a complete inspectorProfile object shape.
(function () {
  function defaultProfileIcon(user) {
    var googleUrl = "";
    if (user && user.photoURL) googleUrl = user.photoURL;
    if (googleUrl) return { type: "google", photoURL: googleUrl, avatarId: "" };
    return { type: "default", photoURL: "", avatarId: "default" };
  }

  window.buildInitialInspectorProfile = function (user) {
    return {
      inspectorName: user && user.displayName ? user.displayName : "",
      licenceNumber: "",
      inspectorEmail: user && user.email ? user.email : "",
      inspectorPhone: "",
      businessName: "",
      businessAddress: "",
      businessAbn: "",
      businessWebsite: "",
      reportEmail: user && user.email ? user.email : "",
      reportPhone: "",
      reportLogoUrl: "",
      reportFooterText: "",
      inspectionNumberPrefix: "BC",
      profileIcon: defaultProfileIcon(user)
    };
  };

  function hasApprovedAccess(profile) {
    if (!profile) return false;
    return profile.approved === true
      || profile.role === "admin"
      || profile.admin === true
      || profile.isAdmin === true
      || profile.verificationStatus === "approved"
      || profile.subscriptionStatus === "active"
      || profile.billingAccess === "active";
  }

  window.goToApp = function () {
    window.location.replace("/app/");
  };

  window.checkApprovalAndContinue = function (user) {
    if (!user || !window.loginDb) return;

    authStateBusy = true;
    setPendingVisible(false);
    setLoginStatus("Checking account approval...", false);

    ensureUserProfile(user)
      .then(function (profile) {
        authStateBusy = false;
        if (hasApprovedAccess(profile)) {
          setLoginStatus("Approved. Opening app...", false);
          window.goToApp();
          return;
        }

        setPendingVisible(true);
        setLoginStatus("Your account is pending inspector verification. We aim to review new accounts within 24 hours. Your first 3 inspections unlock after approval.", true);
      })
      .catch(function (error) {
        authStateBusy = false;
        console.error(error);
        setLoginStatus("Could not check approval: " + error.message, true);
      });
  };
})();
