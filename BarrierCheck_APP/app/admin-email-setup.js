// BarrierCheck admin email setup.
// Writes documents to Firestore so the Firebase Trigger Email extension can send them.
(function () {
  var EMAIL_COLLECTION = "email";
  var SUPPORT_EMAIL = "irongate.pool.bne@gmail.com";
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

  function nl2br(text) {
    return clean(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  }

  function wrapHtmlEmail(title, bodyText) {
    return "<!doctype html><html><body style='margin:0;padding:0;background:#f4f9ff;font-family:Arial,sans-serif;color:#17304f;'>" +
      "<div style='max-width:620px;margin:0 auto;padding:28px 16px;'>" +
      "<div style='background:#ffffff;border:1px solid #e6edf5;border-radius:22px;padding:28px;box-shadow:0 14px 34px rgba(3,40,106,.08);'>" +
      "<h1 style='margin:0 0 14px;color:#03286a;font-size:26px;'>" + title + "</h1>" +
      "<p style='margin:0 0 18px;color:#5c6373;font-size:14px;font-weight:700;'>BarrierCheck Pool Inspection Software</p>" +
      "<div style='font-size:15px;line-height:1.6;'>" + nl2br(bodyText) + "</div>" +
      "</div></div></body></html>";
  }

  function buildEmail(user, template) {
    var firstName = getFirstName(user);
    var subject = "BarrierCheck";
    var text = "";

    if (template === "welcome") {
      subject = "Welcome to BarrierCheck";
      text = "Hi " + firstName + ",\n\n" +
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
      text = "Hi " + firstName + ",\n\n" +
        "Your BarrierCheck account has been approved. Your first 3 inspections are now available.\n\n" +
        "Log in here:\n" + LOGIN_URL + "\n\n" +
        "Before starting your first inspection, please check your inspector profile so your reports show the correct licence, business and contact details.\n\n" +
        "Kind regards,\n" +
        "BarrierCheck Support";
    }

    if (template === "rejection") {
      subject = "BarrierCheck account update";
      text = "Hi " + firstName + ",\n\n" +
        "We could not verify the inspector details provided for your BarrierCheck account.\n\n" +
        "Please reply with your correct QBCC pool safety inspector licence details if you believe this is an error.\n\n" +
        "Kind regards,\n" +
        "BarrierCheck Support";
    }

    if (template === "needs_info") {
      subject = "More information needed for BarrierCheck";
      text = "Hi " + firstName + ",\n\n" +
        "We need a little more information before approving your BarrierCheck account.\n\n" +
        "Please reply with your QBCC pool safety inspector licence number and matching business details.\n\n" +
        "Kind regards,\n" +
        "BarrierCheck Support";
    }

    if (template === "payment") {
      subject = "BarrierCheck payment required";
      text = "Hi " + firstName + ",\n\n" +
        "Your free inspection access has been used. Please log in to continue with paid access.\n\n" +
        LOGIN_URL + "\n\n" +
        "Kind regards,\n" +
        "BarrierCheck Support";
    }

    return {
      subject: subject,
      text: text,
      html: wrapHtmlEmail(subject, text)
    };
  }

  function firestoreTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function recordEmailLog(uid, template, mailId) {
    if (!window.adminDb || !uid) return Promise.resolve();
    var log = {};
    log[template] = {
      queuedAt: firestoreTimestamp(),
      queuedBy: window.adminUser ? window.adminUser.uid : "",
      mailId: mailId || ""
    };
    return window.adminDb.collection("users").doc(uid).set({ emailLog: log, updatedAt: firestoreTimestamp() }, { merge: true });
  }

  window.queueBarrierCheckEmail = function (user, template) {
    if (!window.adminDb) return Promise.reject(new Error("Firestore is not ready."));
    var email = getEmail(user);
    if (!email) return Promise.reject(new Error("This user has no email address."));

    var built = buildEmail(user || {}, template || "welcome");
    var uid = user && user.id ? user.id : "";
    var mailDoc = {
      to: [email],
      replyTo: SUPPORT_EMAIL,
      message: {
        subject: built.subject,
        text: built.text,
        html: built.html
      },
      metadata: {
        app: "BarrierCheck",
        template: template || "welcome",
        userId: uid,
        queuedBy: window.adminUser ? window.adminUser.uid : "",
        queuedFrom: "admin_console"
      },
      createdAt: firestoreTimestamp()
    };

    if (SUPPORT_EMAIL) mailDoc.cc = [SUPPORT_EMAIL];

    return window.adminDb.collection(EMAIL_COLLECTION).add(mailDoc).then(function (docRef) {
      return recordEmailLog(uid, template || "welcome", docRef.id).then(function () {
        if (typeof window.setAdminStatus === "function") {
          window.setAdminStatus("Queued " + (template || "welcome").replace(/_/g, " ") + " email for " + email + ".", false);
        }
        return docRef.id;
      });
    });
  };

  window.mailto = function (user, template) {
    return window.queueBarrierCheckEmail(user, template || "welcome").catch(function (error) {
      console.error(error);
      alert("Could not queue email: " + error.message);
    });
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
      button.textContent = "Send welcome email";
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

  if (typeof window.approveUser === "function") {
    var originalApproveUser = window.approveUser;
    window.approveUser = function (uid) {
      var user = typeof window.getUserById === "function" ? window.getUserById(uid) : null;
      var result = originalApproveUser.apply(this, arguments);
      if (result && typeof result.then === "function") {
        return result.then(function () {
          if (!user) return null;
          return window.queueBarrierCheckEmail(user, "approval").catch(function (error) {
            console.error(error);
            alert("User was approved, but the approval email could not be queued: " + error.message);
          });
        });
      }
      return result;
    };
  }
})();
