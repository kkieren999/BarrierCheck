var FIREBASE_CONFIG = {
  apiKey: "AIza" + "SyB1gB1Ziley9AC1WcGcU2-jvVmKGTgzQO0",
  authDomain: "barriercheck-32290.firebaseapp.com",
  projectId: "barriercheck-32290",
  storageBucket: "barriercheck-32290.firebasestorage.app",
  messagingSenderId: "1058154509337",
  appId: "1:1058154509337:web:d79579a0495f98a0cbe688",
  measurementId: "G-YS4DENY07F"
};

var QBCC_REGISTER_URL = "https://my.qbcc.qld.gov.au/myQBCC/s/pool-safety-inspector-search";
var SUPPORT_EMAIL = "irongate.pool.bne@gmail.com";

var adminAuth = null;
var adminDb = null;
var adminUser = null;
var adminProfile = null;
var allUsers = [];
var selectedUserId = "";
var loadingUsers = false;

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.prototype.slice.call(document.querySelectorAll(selector));
}

function cleanText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setAdminStatus(message, isError) {
  var status = qs("#adminStatus");
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("error", !!isError);
}

function isAdminProfile(profile) {
  return !!(profile && (profile.role === "admin" || profile.admin === true || profile.isAdmin === true));
}

function timestamp() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  var date = new Date(value);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

function toShortDate(value) {
  var ms = toMillis(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
}

function profileOf(user) {
  return user && user.inspectorProfile ? user.inspectorProfile : {};
}

function displayName(user) {
  var p = profileOf(user);
  return cleanText(p.inspectorName || user.displayName || user.email || "Unknown account");
}

function displayEmail(user) {
  var p = profileOf(user);
  return cleanText(user.email || p.inspectorEmail || "");
}

function licenceNumber(user) {
  var p = profileOf(user);
  return cleanText(p.licenceNumber || user.licenceNumber || user.qbccLicenceNumber || "");
}

function businessName(user) {
  var p = profileOf(user);
  return cleanText(p.businessName || user.businessName || "");
}

function roleOf(user) {
  return cleanText(user.role || (user.admin ? "admin" : "pending"));
}

function verificationOf(user) {
  return cleanText(user.verificationStatus || (user.approved ? "approved" : "pending"));
}

function billingOf(user) {
  return cleanText(user.billingAccess || user.subscriptionStatus || "pending_verification");
}

function subscriptionOf(user) {
  return cleanText(user.subscriptionStatus || billingOf(user));
}

function freeLimit(user) {
  var value = Number(user.freeInspectionLimit);
  return isNaN(value) ? 3 : value;
}

function freeUsed(user) {
  var value = Number(user.freeInspectionsUsed);
  return isNaN(value) ? 0 : value;
}

function freeRemaining(user) {
  return Math.max(0, freeLimit(user) - freeUsed(user));
}

function usageOf(user) {
  return user.usage || { total: 0, completed: 0, drafts: 0, lastInspectionAt: null, photos: 0 };
}

function pill(text, type) {
  return "<span class='admin-pill " + escapeHtml(type || "") + "'>" + escapeHtml(text) + "</span>";
}

function statusPill(value) {
  var v = cleanText(value).toLowerCase();
  var label = v ? v.replace(/_/g, " ") : "unknown";
  var type = "";
  if (["approved", "active", "free_inspections"].indexOf(v) >= 0) type = "ok";
  if (["pending", "pending_verification", "needs_more_info", "payment_required", "past_due"].indexOf(v) >= 0) type = "warn";
  if (["rejected", "blocked", "suspended"].indexOf(v) >= 0) type = "bad";
  if (v === "admin") type = "dark";
  return pill(label, type);
}

function accountSearchText(user) {
  return [
    displayName(user),
    displayEmail(user),
    licenceNumber(user),
    businessName(user),
    roleOf(user),
    verificationOf(user),
    billingOf(user),
    subscriptionOf(user)
  ].join(" ").toLowerCase();
}

function matchesFilter(user, filter) {
  var role = roleOf(user).toLowerCase();
  var verification = verificationOf(user).toLowerCase();
  var billing = billingOf(user).toLowerCase();
  var subscription = subscriptionOf(user).toLowerCase();
  if (!filter || filter === "all") return true;
  if (filter === "pending") return verification === "pending" || verification === "needs_more_info" || billing === "pending_verification";
  if (filter === "approved") return verification === "approved" || user.approved === true;
  if (filter === "free") return billing === "free_inspections" || subscription === "free_inspections";
  if (filter === "active") return billing === "active" || subscription === "active";
  if (filter === "payment_required") return billing === "payment_required" || subscription === "payment_required" || billing === "past_due" || subscription === "past_due";
  if (filter === "blocked") return ["rejected", "blocked", "suspended"].indexOf(verification) >= 0 || ["rejected", "blocked", "suspended"].indexOf(billing) >= 0 || ["rejected", "blocked", "suspended"].indexOf(role) >= 0;
  if (filter === "admin") return role === "admin" || user.admin === true || user.isAdmin === true;
  return true;
}

function filteredUsers() {
  var search = cleanText(qs("#userSearchInput") && qs("#userSearchInput").value).toLowerCase();
  var filter = qs("#userFilterSelect") ? qs("#userFilterSelect").value : "all";
  return allUsers.filter(function (user) {
    return matchesFilter(user, filter) && (!search || accountSearchText(user).indexOf(search) >= 0);
  });
}

function renderStats() {
  var stats = {
    pending: 0,
    approved: 0,
    free: 0,
    active: 0,
    blocked: 0,
    inspections: 0
  };

  allUsers.forEach(function (user) {
    var verification = verificationOf(user).toLowerCase();
    var billing = billingOf(user).toLowerCase();
    var role = roleOf(user).toLowerCase();
    if (verification === "pending" || verification === "needs_more_info" || billing === "pending_verification") stats.pending += 1;
    if (verification === "approved" || user.approved === true) stats.approved += 1;
    if (billing === "free_inspections" || subscriptionOf(user).toLowerCase() === "free_inspections") stats.free += 1;
    if (billing === "active" || subscriptionOf(user).toLowerCase() === "active") stats.active += 1;
    if (["rejected", "blocked", "suspended"].indexOf(verification) >= 0 || ["rejected", "blocked", "suspended"].indexOf(billing) >= 0 || ["rejected", "blocked", "suspended"].indexOf(role) >= 0) stats.blocked += 1;
    stats.inspections += usageOf(user).total || 0;
  });

  var items = [
    ["Pending approvals", stats.pending],
    ["Approved inspectors", stats.approved],
    ["Free trial users", stats.free],
    ["Paid / active", stats.active],
    ["Blocked / rejected", stats.blocked],
    ["Total inspections", stats.inspections]
  ];

  var wrap = qs("#adminStats");
  if (!wrap) return;
  wrap.innerHTML = items.map(function (item) {
    return "<article class='admin-stat-card'><strong>" + escapeHtml(item[1]) + "</strong><span>" + escapeHtml(item[0]) + "</span></article>";
  }).join("");
}

function renderPendingUsers() {
  var pending = allUsers.filter(function (user) {
    return matchesFilter(user, "pending");
  }).sort(function (a, b) {
    return toMillis(a.createdAt) - toMillis(b.createdAt);
  });

  var list = qs("#pendingUsersList");
  var empty = qs("#pendingEmptyState");
  if (!list) return;
  list.innerHTML = "";
  if (empty) empty.hidden = pending.length > 0;

  pending.forEach(function (user) {
    var p = profileOf(user);
    var card = document.createElement("article");
    card.className = "pending-user-card";
    card.innerHTML = "" +
      "<h3>" + escapeHtml(displayName(user)) + "</h3>" +
      "<div class='pending-user-grid'>" +
      cell("Email", displayEmail(user) || "—") +
      cell("Licence", licenceNumber(user) || "Not entered") +
      cell("Phone", p.inspectorPhone || user.phone || "Not entered") +
      cell("Business", businessName(user) || "Not entered") +
      cell("Joined", toShortDate(user.createdAt)) +
      cell("Status", verificationOf(user) || "pending") +
      "</div>" +
      "<div class='admin-actions'>" +
      "<button class='admin-secondary-btn' data-action='qbcc' data-uid='" + escapeHtml(user.id) + "' type='button'>Open QBCC Register</button>" +
      "<button class='admin-primary-btn' data-action='approve' data-uid='" + escapeHtml(user.id) + "' type='button'>Approve</button>" +
      "<button class='admin-warn-btn' data-action='needs-info' data-uid='" + escapeHtml(user.id) + "' type='button'>Needs info</button>" +
      "<button class='admin-danger-btn' data-action='reject' data-uid='" + escapeHtml(user.id) + "' type='button'>Reject</button>" +
      "<button class='admin-secondary-btn' data-action='view' data-uid='" + escapeHtml(user.id) + "' type='button'>View profile</button>" +
      "</div>";
    list.appendChild(card);
  });
}

function cell(label, value) {
  return "<span><strong>" + escapeHtml(label) + "</strong>" + escapeHtml(value || "—") + "</span>";
}

function renderUsersTable() {
  var users = filteredUsers().sort(function (a, b) {
    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
  var tbody = qs("#usersTableBody");
  var empty = qs("#usersEmptyState");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (empty) empty.hidden = users.length > 0;

  users.forEach(function (user) {
    var usage = usageOf(user);
    var tr = document.createElement("tr");
    tr.innerHTML = "" +
      "<td><strong>" + escapeHtml(displayName(user)) + "</strong><small>" + escapeHtml(displayEmail(user) || "No email") + "</small><small>" + escapeHtml(businessName(user) || "No business name") + "</small></td>" +
      "<td>" + escapeHtml(licenceNumber(user) || "—") + "</td>" +
      "<td><div class='admin-chip-row'>" + statusPill(roleOf(user)) + statusPill(verificationOf(user)) + statusPill(billingOf(user)) + "</div></td>" +
      "<td><strong>" + freeRemaining(user) + " left</strong><small>Used " + freeUsed(user) + " of " + freeLimit(user) + "</small></td>" +
      "<td><strong>" + (usage.total || 0) + " inspections</strong><small>Completed " + (usage.completed || 0) + " · Drafts " + (usage.drafts || 0) + "</small></td>" +
      "<td>" + escapeHtml(toShortDate(user.createdAt)) + "</td>" +
      "<td><button class='admin-secondary-btn' data-action='view' data-uid='" + escapeHtml(user.id) + "' type='button'>Manage</button></td>";
    tbody.appendChild(tr);
  });
}

function renderAll() {
  renderStats();
  renderPendingUsers();
  renderUsersTable();
  if (selectedUserId) renderUserDetail(selectedUserId);
}

function getUserById(uid) {
  return allUsers.find(function (user) { return user.id === uid; }) || null;
}

function collectPhotoCount(data) {
  var count = 0;
  function visit(value) {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        if (item && typeof item === "object" && (item.url || item.path || item.downloadURL || item.name)) count += 1;
        else visit(item);
      });
      return;
    }
    if (typeof value === "object") {
      Object.keys(value).forEach(function (key) { visit(value[key]); });
    }
  }
  visit(data && data.photos);
  return count;
}

function loadInspectionUsage(user) {
  return adminDb.collection("users").doc(user.id).collection("inspections").get()
    .then(function (snapshot) {
      var usage = { total: 0, completed: 0, drafts: 0, lastInspectionAt: null, photos: 0, recent: [] };
      snapshot.forEach(function (doc) {
        var data = doc.data() || {};
        usage.total += 1;
        var status = cleanText(data.status || data.inspectionStatus).toLowerCase();
        if (status === "completed" || status === "complete" || status === "ready") usage.completed += 1;
        else usage.drafts += 1;
        var updated = data.updatedAt || data.createdAt || null;
        if (toMillis(updated) > toMillis(usage.lastInspectionAt)) usage.lastInspectionAt = updated;
        usage.photos += collectPhotoCount(data);
        usage.recent.push({
          id: doc.id,
          inspectionNumber: data.inspectionNumber || doc.id,
          clientName: data.clientName || data.ownerName || "",
          propertyAddress: data.propertyAddress || data.siteAddress || "",
          status: status || "draft",
          updatedAt: updated
        });
      });
      usage.recent.sort(function (a, b) { return toMillis(b.updatedAt) - toMillis(a.updatedAt); });
      usage.recent = usage.recent.slice(0, 6);
      user.usage = usage;
    })
    .catch(function (error) {
      console.warn("Could not load inspections for " + user.id, error);
      user.usage = { total: 0, completed: 0, drafts: 0, lastInspectionAt: null, photos: 0, recent: [], error: error.message };
    });
}

function loadAllUsers() {
  if (!adminDb || !isAdminProfile(adminProfile) || loadingUsers) return Promise.resolve();
  loadingUsers = true;
  setAdminStatus("Loading accounts...", false);
  return adminDb.collection("users").get()
    .then(function (snapshot) {
      allUsers = [];
      snapshot.forEach(function (doc) {
        var data = doc.data() || {};
        data.id = doc.id;
        allUsers.push(data);
      });
      renderAll();
      setAdminStatus("Loaded " + allUsers.length + " account" + (allUsers.length === 1 ? "" : "s") + ". Loading usage...", false);
      return Promise.all(allUsers.map(loadInspectionUsage));
    })
    .then(function () {
      loadingUsers = false;
      renderAll();
      setAdminStatus("Admin console ready. " + allUsers.length + " account" + (allUsers.length === 1 ? "" : "s") + " loaded.", false);
    })
    .catch(function (error) {
      loadingUsers = false;
      console.error(error);
      setAdminStatus("Could not load accounts: " + error.message, true);
    });
}

function updateUser(uid, data, statusMessage) {
  if (!uid || !adminDb) return Promise.reject(new Error("Missing user id."));
  data.updatedAt = timestamp();
  return adminDb.collection("users").doc(uid).set(data, { merge: true })
    .then(function () {
      setAdminStatus(statusMessage || "Account updated.", false);
      return loadAllUsers();
    });
}

function openQbccRegister() {
  window.open(QBCC_REGISTER_URL, "_blank", "noopener");
}

function approveUser(uid) {
  var user = getUserById(uid);
  if (!user) return;
  var currentLicence = licenceNumber(user);
  var licence = window.prompt("Enter the QBCC / pool safety inspector licence number you verified:", currentLicence || "");
  if (licence === null) return;
  licence = cleanText(licence);
  if (!licence) {
    alert("Enter the verified licence number before approval.");
    return;
  }
  var notes = window.prompt("Verification notes:", "Name and licence matched the QBCC pool safety inspector search.");
  if (notes === null) return;

  var p = profileOf(user);
  var inspectorProfile = Object.assign({}, p, { licenceNumber: licence });
  return updateUser(uid, {
    approved: true,
    admin: user.admin === true || user.role === "admin",
    role: user.role === "admin" ? "admin" : "inspector",
    verificationStatus: "approved",
    verificationMethod: "manual_qbcc_register",
    verificationNotes: notes || "",
    qbccNameMatched: true,
    qbccLicenceMatched: true,
    qbccCheckedAt: timestamp(),
    qbccCheckedBy: adminUser ? adminUser.uid : "",
    licenceNumber: licence,
    inspectorProfile: inspectorProfile,
    subscriptionStatus: subscriptionOf(user) === "active" ? "active" : "free_inspections",
    billingAccess: billingOf(user) === "active" ? "active" : "free_inspections",
    freeInspectionLimit: freeLimit(user),
    freeInspectionsUsed: freeUsed(user),
    freeInspectionsStartedAt: user.freeInspectionsStartedAt || timestamp(),
    approvedAt: timestamp(),
    approvedBy: adminUser ? adminUser.uid : "",
    verifiedAt: timestamp()
  }, "User approved and access unlocked.");
}

function rejectUser(uid) {
  var reason = window.prompt("Rejection reason:", "Inspector details could not be verified against the QBCC register.");
  if (reason === null) return;
  return updateUser(uid, {
    approved: false,
    role: "rejected",
    verificationStatus: "rejected",
    rejectionReason: reason || "",
    verificationNotes: reason || "",
    billingAccess: "blocked",
    subscriptionStatus: "rejected",
    rejectedAt: timestamp(),
    rejectedBy: adminUser ? adminUser.uid : ""
  }, "User rejected and blocked.");
}

function markNeedsInfo(uid) {
  var notes = window.prompt("What information do you need from this user?", "Please provide your QBCC pool safety inspector licence number and matching business details.");
  if (notes === null) return;
  return updateUser(uid, {
    approved: false,
    role: roleOf(getUserById(uid)) === "admin" ? "admin" : "pending",
    verificationStatus: "needs_more_info",
    verificationNotes: notes || "",
    billingAccess: "pending_verification",
    subscriptionStatus: "pending_verification"
  }, "Marked as needs more info.");
}

function suspendUser(uid) {
  var reason = window.prompt("Suspension reason:", "Account suspended by admin.");
  if (reason === null) return;
  return updateUser(uid, {
    approved: false,
    role: roleOf(getUserById(uid)) === "admin" ? "admin" : "suspended",
    verificationStatus: "suspended",
    billingAccess: "blocked",
    subscriptionStatus: "blocked",
    suspensionReason: reason || "",
    suspendedAt: timestamp(),
    suspendedBy: adminUser ? adminUser.uid : ""
  }, "Account suspended.");
}

function reactivateUser(uid) {
  return updateUser(uid, {
    approved: true,
    verificationStatus: "approved",
    billingAccess: "active",
    subscriptionStatus: "active",
    reactivatedAt: timestamp(),
    reactivatedBy: adminUser ? adminUser.uid : ""
  }, "Account reactivated and marked active.");
}

function markManualPaid(uid) {
  return updateUser(uid, {
    approved: true,
    verificationStatus: "approved",
    billingAccess: "active",
    subscriptionStatus: "active",
    manualPaid: true,
    manualPaidAt: timestamp(),
    manualPaidBy: adminUser ? adminUser.uid : ""
  }, "Account marked as manually paid / active.");
}

function requirePayment(uid) {
  return updateUser(uid, {
    billingAccess: "payment_required",
    subscriptionStatus: "payment_required",
    paymentRequiredAt: timestamp(),
    paymentRequiredBy: adminUser ? adminUser.uid : ""
  }, "Account moved to payment required.");
}

function resetFreeInspections(uid) {
  return updateUser(uid, {
    freeInspectionLimit: 3,
    freeInspectionsUsed: 0,
    billingAccess: "free_inspections",
    subscriptionStatus: "free_inspections",
    freeInspectionsStartedAt: timestamp()
  }, "Free inspections reset to 3.");
}

function addFreeInspection(uid) {
  var user = getUserById(uid);
  if (!user) return;
  return updateUser(uid, {
    freeInspectionLimit: freeLimit(user) + 1,
    billingAccess: billingOf(user) === "active" ? "active" : "free_inspections",
    subscriptionStatus: subscriptionOf(user) === "active" ? "active" : "free_inspections"
  }, "Added one extra free inspection.");
}

function setCustomFreeLimit(uid) {
  var user = getUserById(uid);
  if (!user) return;
  var value = window.prompt("Set the total free inspection limit:", String(freeLimit(user)));
  if (value === null) return;
  var limit = Number(value);
  if (isNaN(limit) || limit < 0) {
    alert("Enter a valid number.");
    return;
  }
  return updateUser(uid, { freeInspectionLimit: limit }, "Free inspection limit updated.");
}

function saveVerificationNotes(uid) {
  var field = qs("#detailVerificationNotes");
  return updateUser(uid, {
    verificationNotes: field ? field.value : "",
    verificationNotesUpdatedAt: timestamp(),
    verificationNotesUpdatedBy: adminUser ? adminUser.uid : ""
  }, "Verification notes saved.");
}

function mailto(user, template) {
  var email = displayEmail(user);
  if (!email) {
    alert("This user has no email address.");
    return;
  }
  var name = displayName(user).split(" ")[0] || "there";
  var subject = "BarrierCheck";
  var body = "";

  if (template === "welcome") {
    subject = "Welcome to BarrierCheck";
    body = "Hi " + name + ",\n\nWelcome to BarrierCheck — your pool inspection software account has been created.\n\nLog in here:\nhttps://barriercheck.com.au/app/login/\n\nPlease complete your inspector profile so your details can prefill inspections and reports.\n\nKind regards,\nBarrierCheck Support";
  }
  if (template === "approval") {
    subject = "Your BarrierCheck account has been approved";
    body = "Hi " + name + ",\n\nYour BarrierCheck account has been approved. Your first 3 inspections are now available.\n\nLog in here:\nhttps://barriercheck.com.au/app/login/\n\nKind regards,\nBarrierCheck Support";
  }
  if (template === "rejection") {
    subject = "BarrierCheck account update";
    body = "Hi " + name + ",\n\nWe could not verify the inspector details provided for your BarrierCheck account. Please reply with your correct QBCC pool safety inspector licence details if you believe this is an error.\n\nKind regards,\nBarrierCheck Support";
  }
  if (template === "needs_info") {
    subject = "More information needed for BarrierCheck";
    body = "Hi " + name + ",\n\nWe need a little more information before approving your BarrierCheck account. Please reply with your QBCC pool safety inspector licence number and business details.\n\nKind regards,\nBarrierCheck Support";
  }
  if (template === "payment") {
    subject = "BarrierCheck payment required";
    body = "Hi " + name + ",\n\nYour free inspection access has been used. Please log in to continue with paid access.\n\nhttps://barriercheck.com.au/app/login/\n\nKind regards,\nBarrierCheck Support";
  }

  window.location.href = "mailto:" + encodeURIComponent(email) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body) + "&cc=" + encodeURIComponent(SUPPORT_EMAIL);
}

function detailRow(label, value) {
  return "<div><strong>" + escapeHtml(label) + "</strong>" + escapeHtml(value || "—") + "</div>";
}

function renderUserDetail(uid) {
  var user = getUserById(uid);
  var overlay = qs("#userDetailOverlay");
  var title = qs("#detailTitle");
  var subtitle = qs("#detailSubtitle");
  var content = qs("#detailContent");
  if (!overlay || !title || !subtitle || !content) return;

  if (!user) {
    overlay.hidden = true;
    selectedUserId = "";
    return;
  }

  selectedUserId = uid;
  var p = profileOf(user);
  var usage = usageOf(user);
  title.textContent = displayName(user);
  subtitle.textContent = displayEmail(user) || user.id;

  var recent = usage.recent && usage.recent.length
    ? usage.recent.map(function (item) {
      return "<div>" +
        "<strong>" + escapeHtml(item.inspectionNumber || item.id) + "</strong>" +
        escapeHtml((item.clientName || "No client") + " · " + (item.propertyAddress || "No address") + " · " + (item.status || "draft") + " · " + toShortDate(item.updatedAt)) +
        "</div>";
    }).join("")
    : "<p class='admin-subtle'>No inspections found for this account yet.</p>";

  content.innerHTML = "" +
    "<section class='admin-detail-section'>" +
    "<h3>Account status</h3>" +
    "<div class='admin-chip-row'>" + statusPill(roleOf(user)) + statusPill(verificationOf(user)) + statusPill(billingOf(user)) + statusPill(subscriptionOf(user)) + "</div>" +
    "<div class='admin-detail-grid' style='margin-top:12px'>" +
    detailRow("UID", user.id) + detailRow("Email", displayEmail(user)) + detailRow("Approved", user.approved === true ? "Yes" : "No") + detailRow("Admin", isAdminProfile(user) ? "Yes" : "No") +
    detailRow("Created", toShortDate(user.createdAt)) + detailRow("Updated", toShortDate(user.updatedAt)) + detailRow("Approved at", toShortDate(user.approvedAt)) + detailRow("Verified at", toShortDate(user.verifiedAt)) +
    "</div></section>" +

    "<section class='admin-detail-section'>" +
    "<h3>Inspector profile</h3>" +
    "<div class='admin-detail-grid'>" +
    detailRow("Inspector name", p.inspectorName || user.displayName) + detailRow("Licence", licenceNumber(user)) + detailRow("Inspector email", p.inspectorEmail || displayEmail(user)) + detailRow("Phone", p.inspectorPhone || user.phone) +
    detailRow("Business", businessName(user)) + detailRow("ABN", p.businessAbn) + detailRow("Address", p.businessAddress) + detailRow("Website", p.businessWebsite) +
    detailRow("Report email", p.reportEmail) + detailRow("Report phone", p.reportPhone) + detailRow("Prefix", p.inspectionNumberPrefix || "BC") + detailRow("Profile completed", user.profileCompleted ? "Yes" : "No") +
    "</div></section>" +

    "<section class='admin-detail-section'>" +
    "<h3>Trial and billing</h3>" +
    "<div class='admin-mini-grid'>" +
    detailRow("Free limit", freeLimit(user)) + detailRow("Free used", freeUsed(user)) + detailRow("Free remaining", freeRemaining(user)) + detailRow("Billing access", billingOf(user)) + detailRow("Subscription", subscriptionOf(user)) + detailRow("Stripe customer", user.stripeCustomerId || "—") +
    "</div>" +
    "<div class='admin-actions'>" +
    "<button class='admin-secondary-btn' data-action='add-free' data-uid='" + escapeHtml(uid) + "' type='button'>Add 1 free inspection</button>" +
    "<button class='admin-secondary-btn' data-action='reset-free' data-uid='" + escapeHtml(uid) + "' type='button'>Reset to 3</button>" +
    "<button class='admin-secondary-btn' data-action='set-limit' data-uid='" + escapeHtml(uid) + "' type='button'>Set custom limit</button>" +
    "<button class='admin-primary-btn' data-action='mark-paid' data-uid='" + escapeHtml(uid) + "' type='button'>Mark paid / active</button>" +
    "<button class='admin-warn-btn' data-action='require-payment' data-uid='" + escapeHtml(uid) + "' type='button'>Require payment</button>" +
    "</div></section>" +

    "<section class='admin-detail-section'>" +
    "<h3>Inspection usage</h3>" +
    "<div class='admin-mini-grid'>" +
    detailRow("Total inspections", usage.total || 0) + detailRow("Completed", usage.completed || 0) + detailRow("Drafts", usage.drafts || 0) + detailRow("Photos counted", usage.photos || 0) + detailRow("Last inspection", toShortDate(usage.lastInspectionAt)) + detailRow("Usage error", usage.error || "—") +
    "</div><div class='admin-mini-grid' style='margin-top:12px'>" + recent + "</div></section>" +

    "<section class='admin-detail-section'>" +
    "<h3>Verification and account actions</h3>" +
    "<div class='admin-detail-grid'>" +
    detailRow("Method", user.verificationMethod) + detailRow("QBCC name matched", user.qbccNameMatched === true ? "Yes" : user.qbccNameMatched === false ? "No" : "—") + detailRow("QBCC licence matched", user.qbccLicenceMatched === true ? "Yes" : user.qbccLicenceMatched === false ? "No" : "—") + detailRow("Checked at", toShortDate(user.qbccCheckedAt)) +
    "</div>" +
    "<label class='admin-note-field'><strong>Verification notes</strong><textarea id='detailVerificationNotes'>" + escapeHtml(user.verificationNotes || user.rejectionReason || "") + "</textarea></label>" +
    "<div class='admin-actions'>" +
    "<button class='admin-secondary-btn' data-action='qbcc' data-uid='" + escapeHtml(uid) + "' type='button'>Open QBCC Register</button>" +
    "<button class='admin-secondary-btn' data-action='save-notes' data-uid='" + escapeHtml(uid) + "' type='button'>Save notes</button>" +
    "<button class='admin-primary-btn' data-action='approve' data-uid='" + escapeHtml(uid) + "' type='button'>Approve</button>" +
    "<button class='admin-warn-btn' data-action='needs-info' data-uid='" + escapeHtml(uid) + "' type='button'>Needs info</button>" +
    "<button class='admin-danger-btn' data-action='reject' data-uid='" + escapeHtml(uid) + "' type='button'>Reject</button>" +
    "<button class='admin-danger-btn' data-action='suspend' data-uid='" + escapeHtml(uid) + "' type='button'>Suspend</button>" +
    "<button class='admin-primary-btn' data-action='reactivate' data-uid='" + escapeHtml(uid) + "' type='button'>Reactivate</button>" +
    "</div></section>" +

    "<section class='admin-detail-section'>" +
    "<h3>Email actions</h3>" +
    "<p class='admin-subtle'>These open your email app with a pre-filled message. Later this can be automated through Firebase Functions.</p>" +
    "<div class='admin-actions'>" +
    "<button class='admin-secondary-btn' data-action='email-welcome' data-uid='" + escapeHtml(uid) + "' type='button'>Welcome email</button>" +
    "<button class='admin-secondary-btn' data-action='email-approval' data-uid='" + escapeHtml(uid) + "' type='button'>Approval email</button>" +
    "<button class='admin-secondary-btn' data-action='email-needs-info' data-uid='" + escapeHtml(uid) + "' type='button'>Needs info email</button>" +
    "<button class='admin-secondary-btn' data-action='email-payment' data-uid='" + escapeHtml(uid) + "' type='button'>Payment email</button>" +
    "<button class='admin-secondary-btn' data-action='email-rejection' data-uid='" + escapeHtml(uid) + "' type='button'>Rejection email</button>" +
    "</div></section>";

  overlay.hidden = false;
}

function closeDetail() {
  var overlay = qs("#userDetailOverlay");
  if (overlay) overlay.hidden = true;
  selectedUserId = "";
}

function handleAction(action, uid) {
  var user = getUserById(uid);
  if (action === "view") return renderUserDetail(uid);
  if (action === "qbcc") return openQbccRegister();
  if (!uid) return;
  if (action === "approve") return approveUser(uid);
  if (action === "reject") return rejectUser(uid);
  if (action === "needs-info") return markNeedsInfo(uid);
  if (action === "suspend") return suspendUser(uid);
  if (action === "reactivate") return reactivateUser(uid);
  if (action === "mark-paid") return markManualPaid(uid);
  if (action === "require-payment") return requirePayment(uid);
  if (action === "reset-free") return resetFreeInspections(uid);
  if (action === "add-free") return addFreeInspection(uid);
  if (action === "set-limit") return setCustomFreeLimit(uid);
  if (action === "save-notes") return saveVerificationNotes(uid);
  if (!user) return;
  if (action === "email-welcome") return mailto(user, "welcome");
  if (action === "email-approval") return mailto(user, "approval");
  if (action === "email-rejection") return mailto(user, "rejection");
  if (action === "email-needs-info") return mailto(user, "needs_info");
  if (action === "email-payment") return mailto(user, "payment");
}

function bindEvents() {
  var refresh = qs("#refreshAdminBtn");
  if (refresh) refresh.addEventListener("click", loadAllUsers);

  var signOut = qs("#signOutAdminBtn");
  if (signOut) signOut.addEventListener("click", function () {
    if (!adminAuth) return;
    adminAuth.signOut().then(function () { window.location.replace("/app/login/"); });
  });

  var close = qs("#closeDetailBtn");
  if (close) close.addEventListener("click", closeDetail);

  var overlay = qs("#userDetailOverlay");
  if (overlay) overlay.addEventListener("click", function (event) {
    if (event.target === overlay) closeDetail();
  });

  var search = qs("#userSearchInput");
  if (search) search.addEventListener("input", renderUsersTable);
  var filter = qs("#userFilterSelect");
  if (filter) filter.addEventListener("change", renderUsersTable);

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button) return;
    handleAction(button.getAttribute("data-action"), button.getAttribute("data-uid"));
  });
}

function initAdmin() {
  bindEvents();
  if (!window.firebase || !window.firebase.initializeApp) {
    setAdminStatus("Firebase scripts could not load.", true);
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    adminAuth = firebase.auth();
    adminDb = firebase.firestore();
  } catch (error) {
    setAdminStatus("Firebase setup failed: " + error.message, true);
    return;
  }

  adminAuth.onAuthStateChanged(function (user) {
    adminUser = user || null;
    adminProfile = null;
    allUsers = [];
    renderAll();

    if (!adminUser) {
      setAdminStatus("Sign in first, then open the admin console again.", true);
      setTimeout(function () { window.location.replace("/app/login/"); }, 900);
      return;
    }

    adminDb.collection("users").doc(adminUser.uid).get()
      .then(function (doc) {
        adminProfile = doc.exists ? (doc.data() || {}) : {};
        if (!isAdminProfile(adminProfile)) {
          setAdminStatus("Admin access required. Redirecting...", true);
          setTimeout(function () { window.location.replace("/app/"); }, 900);
          return;
        }
        setAdminStatus("Admin access confirmed. Loading accounts...", false);
        return loadAllUsers();
      })
      .catch(function (error) {
        console.error(error);
        setAdminStatus("Could not check admin access: " + error.message, true);
      });
  });
}

window.addEventListener("DOMContentLoaded", initAdmin);
