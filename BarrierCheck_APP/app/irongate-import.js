// Secure one-click handoff from the IronGate admin console.
// Booking data is sent window-to-window with postMessage and is never placed in the URL.
(function () {
  "use strict";

  var IRONGATE_ORIGIN = "https://irongatepool.com.au";
  var pending = null;
  var importing = false;
  var retryTimer = null;

  function clean(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function mapPurpose(value) {
    var input = clean(value).toLowerCase();
    if (/sale|sell|vendor/.test(input)) return "Sale";
    if (/lease|rent|tenant/.test(input)) return "Lease";
    if (/body corporate|shared|strata/.test(input)) return "Body corporate / shared pool";
    if (/owner|certificate|compliance|initial/.test(input)) return "Owner request";
    return input ? "Other" : "Owner request";
  }

  function mapPoolType(value) {
    var input = clean(value).toLowerCase();
    if (/swim\s*spa/.test(input)) return "Swim spa";
    if (/spa/.test(input)) return "Spa";
    if (/above/.test(input)) return "Above-ground pool";
    if (/in[- ]?ground|inground/.test(input)) return "In-ground pool";
    if (/indoor/.test(input)) return "Indoor pool";
    if (/outdoor/.test(input)) return "Outdoor pool";
    return input ? "Other" : "Other";
  }

  function notes(bookingId, b) {
    return [
      "Imported from IronGate booking " + bookingId + ".",
      b.preferredTimeLabel || b.preferredTime ? "Appointment: " + clean(b.preferredTimeLabel || b.preferredTime) : "",
      b.customerName ? "Booking contact: " + clean(b.customerName) : "",
      b.phone ? "Booking phone: " + clean(b.phone) : "",
      b.email ? "Booking email: " + clean(b.email) : "",
      b.agencyName ? "Agency: " + clean(b.agencyName) : "",
      b.accessContactName ? "Access contact: " + clean(b.accessContactName) : "",
      b.accessContactPhone ? "Access phone: " + clean(b.accessContactPhone) : "",
      b.accessMethod ? "Access method: " + clean(b.accessMethod) : "",
      b.keyCollectionLocation ? "Key collection / lockbox: " + clean(b.keyCollectionLocation) : "",
      b.accessInstructions ? "Access instructions: " + clean(b.accessInstructions) : "",
      b.animalsOnProperty === true ? "Animals on property: yes" + (b.animalsWillBeSecured === true ? " — confirmed secured." : ".") : "",
      b.hasPoolExemption === true ? "Booking indicates a pool exemption may apply." : "",
      b.notes ? "Booking notes: " + clean(b.notes) : "",
      b.inspectionReason ? "IronGate inspection reason: " + clean(b.inspectionReason) : ""
    ].filter(Boolean).join("\n");
  }

  function reply(message) {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, IRONGATE_ORIGIN);
      }
    } catch (error) {}
  }

  function existingInspection(bookingId) {
    if (typeof window.getInspections !== "function") return null;
    var inspections = window.getInspections() || [];
    for (var i = 0; i < inspections.length; i += 1) {
      var item = inspections[i] || {};
      var fields = item.fields || {};
      if (clean(fields.sourceBookingId) === bookingId || clean(item.sourceBookingId) === bookingId) {
        return item;
      }
    }
    return null;
  }

  function readyForImport() {
    return typeof window.canUseApp === "function" &&
      window.canUseApp() &&
      typeof window.startNewInspection === "function" &&
      typeof window.setNamedFieldValue === "function" &&
      typeof window.saveCurrentInspection === "function";
  }

  function finishExisting(item, bookingId) {
    if (typeof window.loadInspectionIntoForm === "function") {
      window.loadInspectionIntoForm(item);
      if (typeof window.showTab === "function") window.showTab("details");
    }
    reply({
      type: "barriercheck-import-result",
      ok: true,
      reused: true,
      bookingId: bookingId,
      inspectionId: item.id || ""
    });
    pending = null;
    importing = false;
  }

  function fillImportedFields(bookingId, b) {
    var ownerName = clean(b.poolOwnerName || b.customerName);
    var ownerPhone = clean(b.poolOwnerPhone || b.phone);
    var ownerEmail = clean(b.poolOwnerEmail || b.email).toLowerCase();
    var combinedNotes = notes(bookingId, b);

    window.setNamedFieldValue("sourceBookingId", bookingId);
    window.setNamedFieldValue("inspectionDate", clean(b.preferredDate));
    window.setNamedFieldValue("ownerName", ownerName);
    window.setNamedFieldValue("ownerPhone", ownerPhone);
    window.setNamedFieldValue("ownerEmail", ownerEmail);
    window.setNamedFieldValue("propertyAddress", clean(b.propertyAddress));
    window.setNamedFieldValue("inspectionType", "Initial inspection");
    window.setNamedFieldValue("inspectionPurpose", mapPurpose(b.inspectionReason));
    window.setNamedFieldValue("poolType", mapPoolType(b.poolType));
    window.setNamedFieldValue("sharedPool", "Unknown");
    window.setNamedFieldValue("inspectionNotes", combinedNotes);
    window.setNamedFieldValue("preInspectionNotes", combinedNotes);

    window.saveCurrentInspection(false);
    if (typeof window.renderInspectionList === "function") window.renderInspectionList();
    if (typeof window.showTab === "function") window.showTab("details");
  }

  function createInspection(bookingId, b) {
    importing = true;
    var previousId = window.currentInspectionId || "";
    window.startNewInspection();

    var attempts = 0;
    var waitForStart = window.setInterval(function () {
      attempts += 1;
      var started = !!window.inspectionStarted && !!window.currentInspectionId &&
        window.currentInspectionId !== previousId;

      if (started) {
        window.clearInterval(waitForStart);
        fillImportedFields(bookingId, b);
        reply({
          type: "barriercheck-import-result",
          ok: true,
          reused: false,
          bookingId: bookingId,
          inspectionId: window.currentInspectionId || ""
        });
        pending = null;
        importing = false;
        return;
      }

      if (attempts >= 80) {
        window.clearInterval(waitForStart);
        importing = false;
        reply({
          type: "barriercheck-import-result",
          ok: false,
          bookingId: bookingId,
          error: "BarrierCheck could not start the inspection. Check account access and try again."
        });
      }
    }, 250);
  }

  function attemptImport() {
    if (!pending || importing) return;

    var bookingId = clean(pending.bookingId);
    var booking = pending.booking && typeof pending.booking === "object" ? pending.booking : {};
    if (!/^[A-Za-z0-9_-]{8,120}$/.test(bookingId)) {
      reply({ type: "barriercheck-import-result", ok: false, bookingId: bookingId, error: "Invalid IronGate booking reference." });
      pending = null;
      return;
    }

    if (!readyForImport()) {
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(attemptImport, 500);
      return;
    }

    var existing = existingInspection(bookingId);
    if (existing) {
      finishExisting(existing, bookingId);
      return;
    }

    createInspection(bookingId, booking);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== IRONGATE_ORIGIN || event.source !== window.opener) return;
    var data = event.data || {};
    if (data.type !== "irongate-create-inspection" || data.version !== 1) return;
    pending = data;
    attemptImport();
  });

  function announceReady() {
    reply({ type: "barriercheck-ready", version: 1 });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", announceReady, { once: true });
  } else {
    announceReady();
  }

  var readyCount = 0;
  var readyPulse = window.setInterval(function () {
    readyCount += 1;
    if (!pending) announceReady();
    if (pending || readyCount >= 20 || !window.opener || window.opener.closed) {
      window.clearInterval(readyPulse);
    }
  }, 750);
})();
