// Login access patch for owner/admin accounts.
// This lets BarrierCheck open for users marked as approved, admin, or active in Firestore.
(function () {
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
