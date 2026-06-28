// BarrierCheck admin email setup.
// This first version opens the admin's email app with prefilled messages.
// Later this can be replaced with Firebase Functions or a transactional email provider.
(function () {
  var SUPPORT_EMAIL_OVERRIDE = "irongate.pool.bne@gmail.com";
  var LOGIN_URL = "https://barriercheck.com.au/app/login/";

  function clean(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function getProfile(user) {
    return user && user.inspectorProfile ? user.inspectorProfile : {};
  }

  function getName(user) {
    var profile = getProfile(user);
    return clean(profile.inspectorName || user.displayName || user.email || "there");
  }

  function getFirstName(user) {
    var name = getName(user);
    if (!name || name.indexOf("@") > -1) return "there";
    return name.split(" ")[0] || "there";
  }

  function getEmail(user) {
    var profile = getProfile(user);
    return clean(user.email || profile.inspectorEmail || "");
  }

  function buildEmail(user, template) {
    var firstName = getFirstName(user);
    var subject = "BarrierCheck";
    var body = "";

    if (template === "welcome") {
      subject = "Welcome to BarrierCheck";
      body = "Hi " + firstName + ",\n\n" +
        "Welcome to BarrierCheck — your pool inspection software account has been created.\n\n" +
        "BarrierCheck helps pool safety inspectors complete inspections, organise evidence photos and prepare professional reports from one simple workflow.\n\n" +
        "Log in here:\n" + LOGIN_URL + "\n\n" +
        "Next step: please complete your inspector profile. These details are used to prefill inspections and appear on your reports.\n\n" +
        "Your first 3 inspections are free once your inspector account has been approved. New accounts may be reviewed to confirm they are for pool safety inspection use.\n\n" +
        "If you need help getting started, reply to this email.\n\n" +
        "Kind regards,\n" +
        "BarrierCheck Support";
    }

    if (template === "approval") {
      subject = "Your BarrierCheck account has been approved";
      body = "Hi " + firstName + ",\n\n" +
        "Your BarrierCheck account has been approved. Your first 3 inspections are now available.\n\n" +
        "Log in here:\n" + LOGIN_URL + "\n\n" +
        "Before starting your first inspection, please check your inspector profile so your reports show the correct licence, business and contact details.\n\n" +
        "Kind regards,\n" +
        "BarrierCheck Support";
    }

    if (template === "rejection") {
      subject = "BarrierCheck account update";
      body = "Hi " + firstName + ",\n\n" +
        "We could not verify the inspector details provided for your BarrierCheck account.\n\n" +
        "Please reply with your correct QBCC pool safety inspector licence details if you believe this is an error.\n\n" +
        "Kind regards,\n" +
        "BarrierCheck Support";
    }

    if (template === "needs_info") {
      subject = "More information needed for BarrierCheck";
      body = "Hi " + firstName + ",\n\n" +
        "We need a little more information before approving your BarrierCheck account.\n\n" +
        "Please reply with your QBCC pool safety inspector licence number and matching business details.\n\n" +
        "Kind regards,\n" +
        "BarrierCheck Support";
    }

    if (template === "payment") {
      subject = "BarrierCheck payment required";
      body = "Hi " + firstName + ",\n\n" +
        "Your free inspection access has been used. Please log in to continue with paid access.\n\n" +
        LOGIN_URL + "\n\n" +
        "Kind regards,\n" +
        "BarrierCheck Support";
    }

    return { subject: subject, body: body };
  }

  window.mailto = function (user, template) {
    var email = getEmail(user);
    if (!email) {
      alert("This user has no email address.");
      return;
    }

    var built = buildEmail(user || {}, template || "welcome");
    window.location.href = "mailto:" + encodeURIComponent(email) +
      "?subject=" + encodeURIComponent(built.subject) +
      "&body=" + encodeURIComponent(built.body) +
      "&cc=" + encodeURIComponent(SUPPORT_EMAIL_OVERRIDE);
  };

  function addWelcomeButtonsToPendingCards() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".pending-user-card"));
    cards.forEach(function (card) {
      var actions = card.querySelector(".admin-actions");
      if (!actions || actions.querySelector("[data-action='email-welcome']")) return;
      var existing = actions.querySelector("[data-uid]");
      var uid = existing ? existing.getAttribute("data-uid") : "";
      if (!uid) return;
      var button = document.createElement("button");
      button.className = "admin-secondary-btn";
      button.type = "button";
      button.setAttribute("data-action", "email-welcome");
      button.setAttribute("data-uid", uid);
      button.textContent = "Welcome email";
      actions.appendChild(button);
    });
  }

  if (typeof window.renderPendingUsers === "function") {
    var originalRenderPendingUsers = window.renderPendingUsers;
    window.renderPendingUsers = function () {
      originalRenderPendingUsers.apply(this, arguments);
      addWelcomeButtonsToPendingCards();
    };
  }
})();
