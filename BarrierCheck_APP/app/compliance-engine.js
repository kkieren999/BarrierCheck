// BarrierCheck Queensland compliance decision engine.
// Adds conditional decision logic and a detailed audit snapshot without
// replacing the inspector's professional judgement or the existing raw record.
(function () {
  "use strict";

  var VERSION = "20261005.1";
  var SOURCE_SET = "QDC MP 3.4 + AS 1926.1-2007 + AS 1926.2-2007 + Queensland PSI Guideline 2024";
  var updateTimer = null;
  var augmentQueued = false;
  var priorCollectFindings = window.collectFindings;
  var priorEvaluateComplianceForElement = window.evaluateComplianceForElement;
  var priorRestoreCardFields = window.restoreCardFields;
  var priorRestoreFields = window.restoreFields;
  var priorClearFormForNewInspection = window.clearFormForNewInspection;
  var priorSaveCurrentInspection = window.saveCurrentInspection;

  var OBSOLETE_ATOMIC_IDS = {
    "boundary-height-1800": true,
    "water-barrier-depth-300": true,
    "ncz-object-distance-900": true,
    "ncz-horizontal-surface": true
  };

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function clean(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function num(value) {
    if (value === undefined || value === null || clean(value) === "") return null;
    var result = Number(String(value).replace(/[^0-9.\-]/g, ""));
    return isNaN(result) ? null : result;
  }

  function value(name, root) {
    var el = qs('[name="' + name + '"]', root);
    if (!el) return "";
    return el.type === "checkbox" ? !!el.checked : clean(el.value);
  }

  function setValue(name, newValue, root) {
    var el = qs('[name="' + name + '"]', root);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!newValue;
    else el.value = newValue === undefined || newValue === null ? "" : String(newValue);
  }

  function itemTitle(card, fallback) {
    if (!card) return fallback || "Inspection item";
    var h = qs(".fence-card-head h3", card) || qs("h3", card);
    return h ? clean(h.textContent) : (fallback || "Inspection item");
  }

  function evidenceAreas(card) {
    return qsa('.photo-widget[data-photo-area]', card).map(function (widget) {
      return widget.getAttribute("data-photo-area");
    }).filter(Boolean);
  }

  function inspectorNotes(card) {
    return qsa("textarea", card).map(function (el) {
      if (el.name === "complianceDecisionSnapshot" || el.name === "complianceAuthorityRecords") return "";
      return clean(el.value);
    }).filter(Boolean).join(" ");
  }

  function layout() {
    try {
      var raw = value("barrierLayoutConfig");
      return raw ? JSON.parse(raw) : { fences: [], gates: [], components: {} };
    } catch (error) {
      return { fences: [], gates: [], components: {} };
    }
  }

  function fieldBlock(label, control, helper, full) {
    return '<label class="field' + (full ? ' full' : '') + ' bc-engine-field"><span>' + label + '</span>' +
      control + (helper ? '<small class="bc-engine-helper">' + helper + '</small>' : '') + '</label>';
  }

  function yesNoSelect(name, placeholder) {
    return '<select data-save name="' + name + '"><option value="">' + (placeholder || "Select") + '</option><option>Yes</option><option>No</option><option>N/A</option></select>';
  }

  function addGroup(card, id, title, html) {
    if (!card || qs('[data-bc-engine-group="' + id + '"]', card)) return;
    var group = document.createElement("div");
    group.className = "details-group numbered-group bc-engine-group";
    group.setAttribute("data-bc-engine-group", id);
    group.innerHTML = '<div class="group-title-row"><span class="group-number">↳</span><h3>' + title + '</h3></div><div class="form-grid">' + html + '</div>';
    var photoWidget = qs(".photo-widget", card);
    if (photoWidget) card.insertBefore(group, photoWidget);
    else card.appendChild(group);
  }

  function augmentFence(card) {
    var type = value("fenceType", card).toLowerCase();
    var isMesh = /mesh|chainwire|perforat/.test(type);
    addGroup(card, "fence-evidence", "Conditional compliance evidence",
      fieldBlock("Strength assessment method",
        '<select data-save name="fenceStrengthAssessmentMethod"><option value="">Select method</option><option>Visual inspection</option><option>Manual squeeze assessment</option><option>Instrumented / load assessment</option><option>Documented product evidence</option><option>Combination of methods</option><option>Other</option></select>',
        "Records how the strength / rigidity conclusion was reached.", false) +
      fieldBlock("Strength / test evidence notes",
        '<textarea data-save name="fenceStrengthTestEvidence" placeholder="Panel type tested, location, observed deformation, test result or supporting evidence..."></textarea>',
        "Keep enough detail to substantiate the inspector decision.", true) +
      fieldBlock("Top strainer wire / rail present (mesh only)", yesNoSelect("fenceMeshTopStrainer"), "", false) +
      fieldBlock("Bottom strainer wire / rail present (mesh only)", yesNoSelect("fenceMeshBottomStrainer"), "", false) +
      fieldBlock("Compliant cranked top relied on", yesNoSelect("fenceCrankedTopCompliant"), "Relevant only where that QDC mesh arrangement is being relied upon.", false)
    );
    var meshFields = qsa('[name="fenceMeshTopStrainer"],[name="fenceMeshBottomStrainer"],[name="fenceCrankedTopCompliant"]', card);
    meshFields.forEach(function (el) {
      var label = el.closest(".field");
      if (label) label.style.display = isMesh ? "" : "none";
    });
  }

  function augmentClimbability(card) {
    addGroup(card, "ncz-evidence", "NCZ decision evidence",
      fieldBlock("Object reasonably accessible to a young child", yesNoSelect("nczObjectChildAccessible"),
        "Use No only where the recorded arrangement means the object cannot reasonably be reached/used for climbing.", false) +
      fieldBlock("Object / vegetation can support a young child", yesNoSelect("nczObjectSupportsChild"),
        "Useful for vegetation or features that may be present but are not practically climbable.", false) +
      fieldBlock("900mm NCZ extension beyond fence end / intersection compliant", yesNoSelect("nczEndExtensionCompliant"),
        "Record where an outside NCZ reaches a fence end, corner, intersection or another barrier/object.", false)
    );
  }

  function augmentBoundary(card) {
    addGroup(card, "boundary-evidence", "Boundary-fence decision evidence",
      fieldBlock("NCZ side relied upon",
        '<select data-save name="boundaryNczSide"><option value="">Select side</option><option>Outside pool area</option><option>Inside pool area</option><option>Both / requires assessment</option><option>N/A</option></select>',
        "A boundary fence below 1800mm can only rely on the outside NCZ arrangement.", false)
    );
  }

  function augmentGate(card) {
    addGroup(card, "gate-evidence", "Special gate / latch evidence",
      fieldBlock("Chameleon-gate arrangement", yesNoSelect("gateIsChameleon"),
        "A chameleon-gate arrangement at an outdoor pool is not an accepted way of preventing direct building access.", false) +
      fieldBlock("For a double-leaf gate, one leaf is permanently fixed / permanent centre fixture provided", yesNoSelect("gateFixedLeafPermanent"),
        "Use N/A for gates that are not double-leaf.", false) +
      fieldBlock("Each operable leaf self-closes and self-latches", yesNoSelect("gateEachLeafSelfClosesLatches"),
        "Use N/A for gates that are not double-leaf.", false) +
      fieldBlock("Lower-latch shielding geometry verified", yesNoSelect("gateLowerLatchGeometryVerified"),
        "Use where the latch release is below the usual 1500mm position and a permitted shielding arrangement is relied upon.", false) +
      fieldBlock("Lower horizontal member height below latch (mm)",
        '<input data-save name="gateHighestLowerHorizontalToLatch" type="number" placeholder="e.g. 1400">',
        "Retains the measured geometry where relevant to a lower latch arrangement.", false)
    );
  }

  function augmentWater(card) {
    addGroup(card, "water-evidence", "Permanent-water barrier evidence",
      fieldBlock("Width of water adjacent to protected pool edge (mm)",
        '<input data-save name="waterBarrierWidth" type="number" placeholder="1800">', "", false) +
      fieldBlock("Access to pool over / under water prevented", yesNoSelect("waterBarrierAccessPrevented"), "", false) +
      fieldBlock("Required 900mm return / overhang treatment compliant", yesNoSelect("waterBarrierIntersectionTreatment"),
        "Record the treatment where a required barrier intersects the body of water.", false) +
      fieldBlock("Return / overhang surface free of climbable handholds / footholds", yesNoSelect("waterBarrierSurfaceNonClimbable"), "", false)
    );
  }

  function augmentWindow(card) {
    addGroup(card, "window-evidence", "Window decision measurements",
      fieldBlock("External sill to pool-area level h1 (mm)",
        '<input data-save name="barrierWindowExternalSillHeight" type="number" placeholder="1800">', "", false) +
      fieldBlock("Internal floor to sill h2 (mm)",
        '<input data-save name="barrierWindowInternalSillHeight" type="number" placeholder="900">', "", false) +
      fieldBlock("Protection method",
        '<select data-save name="barrierWindowProtectionMethod"><option value="">Select method</option><option>Fixed bars / mesh screen</option><option>Restricted opening</option><option>Other permitted arrangement</option><option>N/A</option></select>', "", false) +
      fieldBlock("Maximum openable gap (mm)",
        '<input data-save name="barrierWindowMaxOpening" type="number" placeholder="100">', "", false)
    );
  }

  function augmentDoor(card) {
    addGroup(card, "door-evidence", "Building-access decision evidence",
      fieldBlock("Door provides direct access from building into pool area", yesNoSelect("barrierDoorDirectPoolAccess"), "", false) +
      fieldBlock("Door opens away from pool area", yesNoSelect("barrierDoorSwingsAway"), "Required where a child-resistant doorset is lawfully used for an indoor pool.", false) +
      fieldBlock("Verified exemption / approved solution specifically applies to this access", yesNoSelect("barrierDoorAuthorityApplies"),
        "If Yes, link the authority in the Authorities / approvals record below. BarrierCheck will require inspector review rather than assuming the authority's scope.", false)
    );
  }

  function augmentRetaining(card) {
    addGroup(card, "retaining-evidence", "Retaining-wall decision evidence",
      fieldBlock("Wall relationship to pool level",
        '<select data-save name="retainingWallRelation"><option value="">Select</option><option>Above pool level</option><option>Below pool level</option><option>Other / complex arrangement</option></select>', "", false) +
      fieldBlock("Slope requirement satisfied", yesNoSelect("retainingWallSlopeCompliant"),
        "Record the assessment of the applicable 15° relationship.", false) +
      fieldBlock("Fence intersects retaining wall", yesNoSelect("retainingWallFenceIntersects"), "", false) +
      fieldBlock("Required 900mm overhang / return treatment compliant", yesNoSelect("retainingWallIntersectionTreatment"),
        "Relevant where a fence intersects the retaining wall.", false)
    );
  }

  function augmentBalcony(card) {
    addGroup(card, "balcony-evidence", "Balcony / deck decision measurements",
      fieldBlock("Balcony floor to pool-area ground level h3 (mm)",
        '<input data-save name="balconyDropHeight" type="number" placeholder="1800">', "", false) +
      fieldBlock("Nearest balcony floor perimeter to top of barrier (mm)",
        '<input data-save name="balconyDistanceToBarrierTop" type="number" placeholder="900">', "", false) +
      fieldBlock("Required balcony NCZ arrangement compliant", yesNoSelect("balconyNczCompliant"),
        "Record where the balcony projects into the pool area / NCZ and a compliant barrier is not otherwise provided to the balcony.", false)
    );
  }

  function augmentSpecial(card) {
    addGroup(card, "special-evidence", "Above-ground / special-pool evidence",
      fieldBlock("Designated pool access point enclosed by compliant barrier and gate", yesNoSelect("designatedAccessPointEnclosed"),
        "Relevant to above-ground pools, including where a permanent access ladder is installed.", false)
    );
    var pump = qs('[name="pumpFilterClimbableAccess"]', card);
    var label = pump && pump.closest(".field") ? qs("span", pump.closest(".field")) : null;
    if (label) label.textContent = "Pump / filter clear of NCZ and not creating climbable access";
  }

  function augmentTemporary(card) {
    addGroup(card, "temporary-evidence", "Temporary-fence approval record",
      fieldBlock("Context",
        '<select data-save name="temporaryFenceContext"><option value="">Select</option><option>New pool</option><option>Existing pool - barrier work</option><option>Other building work</option><option>Other</option></select>', "", false) +
      fieldBlock("Approval / inspection status",
        '<select data-save name="temporaryFenceApprovalStatus"><option value="">Select</option><option>Approved by building certifier</option><option>Approved by pool safety inspector where permitted</option><option>Approval not sighted</option><option>N/A</option></select>', "", false) +
      fieldBlock("Approval / inspection date", '<input data-save name="temporaryFenceApprovalDate" type="date">', "", false) +
      fieldBlock("Current approved period end date", '<input data-save name="temporaryFencePeriodEndDate" type="date">', "", false)
    );
  }

  function augmentDecommissioned(card) {
    addGroup(card, "decommission-evidence", "Decommissioning / conversion evidence",
      fieldBlock("Final building approval confirms structure is no longer a swimming pool", yesNoSelect("decommissionFinalApproval"),
        "A change of current use alone does not establish that a structure originally designed as a swimming pool has ceased to be a regulated swimming pool.", true) +
      fieldBlock("Approval / certifier reference",
        '<input data-save name="decommissionApprovalReference" type="text" placeholder="Approval number / certifier / council reference">', "", true)
    );
  }

  function augmentCard(card) {
    if (!card || !card.classList) return;
    if (card.matches('.fence-card[data-section="fence"]')) augmentFence(card);
    if (card.classList.contains("climbability-card")) augmentClimbability(card);
    if (card.classList.contains("boundary-card")) augmentBoundary(card);
    if (card.classList.contains("gate-card")) augmentGate(card);
    if (card.classList.contains("water-barrier-card")) augmentWater(card);
    if (card.classList.contains("barrier-window-card")) augmentWindow(card);
    if (card.classList.contains("barrier-door-card")) augmentDoor(card);
    if (card.classList.contains("retaining-wall-card")) augmentRetaining(card);
    if (card.classList.contains("balcony-card")) augmentBalcony(card);
    if (card.classList.contains("special-pool-feature-card")) augmentSpecial(card);
    if (card.classList.contains("temporary-fence-card")) augmentTemporary(card);
    if (card.classList.contains("decommissioned-pool-card")) augmentDecommissioned(card);
  }

  function augmentAllCards() {
    qsa(".fence-card").forEach(augmentCard);
  }

  function ensureStaticAuditFields() {
    var detailsList = qs(".details-check-list");
    if (!detailsList || qs('[data-bc-engine-static="1"]')) return;

    var details = document.createElement("details");
    details.className = "details-check-group";
    details.setAttribute("data-bc-engine-static", "1");
    details.innerHTML =
      '<summary class="details-check-summary"><div class="details-check-title"><span class="group-number">5</span><div><h3>Authorities, decisions & statutory workflow</h3><p>Detailed backend evidence for exemptions, performance solutions, variations, notices and reinspections.</p></div></div><span aria-hidden="true" class="modern-collapse-btn"><span class="modern-chevron">▼</span></span></summary>' +
      '<div class="details-check-body">' +
        '<div class="bc-authority-editor">' +
          '<h4>Authorities / exemptions / performance solutions</h4>' +
          '<p class="helper-text">Record each authority relied upon. BarrierCheck stores the full list in the inspection record and does not automatically assume that an authority changes a rule unless the inspector identifies its scope.</p>' +
          '<textarea data-save name="complianceAuthorityRecords" class="streamline-hidden" aria-hidden="true" tabindex="-1"></textarea>' +
          '<div id="bcAuthorityRecords"></div>' +
          '<button id="bcAddAuthorityBtn" class="add-section-btn" type="button"><span>+</span> Add authority / approval</button>' +
        '</div>' +
        '<div class="details-group numbered-group bc-engine-group"><div class="group-title-row"><span class="group-number">A</span><h3>Statutory workflow record</h3></div><div class="form-grid">' +
          fieldBlock("Previous nonconformity notice date", '<input data-save name="previousNonconformityNoticeDate" type="date">', "", false) +
          fieldBlock("Current nonconformity notice issued date", '<input data-save name="nonconformityNoticeIssuedDate" type="date">', "", false) +
          fieldBlock("Minor-repairs agreement made", yesNoSelect("minorRepairsAgreement"), "", false) +
          fieldBlock("Minor-repairs agreed completion date", '<input data-save name="minorRepairsDueDate" type="date">', "", false) +
          fieldBlock("Reinspection requested date", '<input data-save name="reinspectionRequestedDate" type="date">', "", false) +
          fieldBlock("Reinspection completed date", '<input data-save name="reinspectionCompletedDate" type="date">', "", false) +
          fieldBlock("Local-government notification required", yesNoSelect("localGovernmentNotificationRequired"), "", false) +
          fieldBlock("Local-government notification date", '<input data-save name="localGovernmentNotificationDate" type="date">', "", false) +
          fieldBlock("Decision rationale / relevant facts relied upon", '<textarea data-save name="complianceDecisionRationale" placeholder="Why the final compliance decision was reached; tests, documents, unusual site facts or professional judgement relied upon..."></textarea>', "This is retained for the inspector/backend record.", true) +
        '</div></div>' +
        '<textarea data-save name="complianceDecisionSnapshot" class="streamline-hidden" aria-hidden="true" tabindex="-1"></textarea>' +
        '<input data-save name="complianceEngineVersion" class="streamline-hidden" aria-hidden="true" tabindex="-1" value="' + VERSION + '">' +
      '</div>';
    detailsList.appendChild(details);

    var add = qs("#bcAddAuthorityBtn");
    if (add) add.addEventListener("click", function () {
      var records = readAuthorityRecords();
      records.push({ type: "", reference: "", issuer: "", date: "", verified: "", scope: "", conditions: "" });
      writeAuthorityRecords(records);
      renderAuthorityRecords();
      scheduleUpdate();
    });
    renderAuthorityRecords();
  }

  function readAuthorityRecords() {
    var field = qs('[name="complianceAuthorityRecords"]');
    if (!field || !clean(field.value)) return [];
    try {
      var parsed = JSON.parse(field.value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeAuthorityRecords(records) {
    var field = qs('[name="complianceAuthorityRecords"]');
    if (field) field.value = JSON.stringify(records || []);
  }

  function renderAuthorityRecords() {
    var host = qs("#bcAuthorityRecords");
    if (!host) return;
    var records = readAuthorityRecords();
    host.innerHTML = "";
    records.forEach(function (record, index) {
      var card = document.createElement("article");
      card.className = "fence-card bc-authority-card";
      card.setAttribute("data-authority-index", String(index));
      card.innerHTML =
        '<div class="fence-card-head"><h3>Authority / approval ' + (index + 1) + '</h3><button type="button" class="remove-section-btn bc-remove-authority">Remove</button></div>' +
        '<div class="form-grid">' +
          fieldBlock("Type", '<select data-authority-field="type"><option value="">Select</option><option>Disability exemption</option><option>Impracticality exemption</option><option>Performance solution</option><option>Variation</option><option>Appeal / decision</option><option>Building approval / certificate</option><option>Other</option></select>', "", false) +
          fieldBlock("Reference", '<input data-authority-field="reference" type="text" placeholder="Decision / approval / register reference">', "", false) +
          fieldBlock("Issuer / authority", '<input data-authority-field="issuer" type="text" placeholder="Local government / chief executive / certifier / other">', "", false) +
          fieldBlock("Date", '<input data-authority-field="date" type="date">', "", false) +
          fieldBlock("Verified / sighted", '<select data-authority-field="verified"><option value="">Select</option><option>Yes</option><option>No</option></select>', "", false) +
          fieldBlock("Scope / rules affected", '<textarea data-authority-field="scope" placeholder="Exactly what part of the barrier / standard this authority changes or permits..."></textarea>', "", true) +
          fieldBlock("Conditions", '<textarea data-authority-field="conditions" placeholder="Conditions, limitations, expiry or other decision requirements..."></textarea>', "", true) +
        '</div>';
      host.appendChild(card);

      Object.keys(record || {}).forEach(function (key) {
        var el = qs('[data-authority-field="' + key + '"]', card);
        if (el) el.value = record[key] || "";
      });

      card.addEventListener("input", authorityCardChanged);
      card.addEventListener("change", authorityCardChanged);
      var remove = qs(".bc-remove-authority", card);
      if (remove) remove.addEventListener("click", function () {
        var current = readAuthorityRecords();
        current.splice(index, 1);
        writeAuthorityRecords(current);
        renderAuthorityRecords();
        scheduleUpdate();
      });
    });
  }

  function authorityCardChanged(event) {
    var card = event.target.closest(".bc-authority-card");
    if (!card) return;
    var index = Number(card.getAttribute("data-authority-index"));
    var records = readAuthorityRecords();
    if (!records[index]) records[index] = {};
    qsa("[data-authority-field]", card).forEach(function (el) {
      records[index][el.getAttribute("data-authority-field")] = el.value;
    });
    writeAuthorityRecords(records);
    scheduleUpdate();
  }

  function hasVerifiedAuthorityFor(term) {
    term = clean(term).toLowerCase();
    return readAuthorityRecords().some(function (record) {
      return clean(record.verified).toLowerCase() === "yes" &&
        clean(record.scope).toLowerCase().indexOf(term) !== -1;
    });
  }

  function decision(id, status, category, item, field, inputs, requirement, reason, action, source, card) {
    return {
      id: id,
      status: status,
      category: category,
      item: item,
      field: field,
      inputs: inputs || {},
      requirement: requirement || "",
      reason: reason || "",
      action: action || "",
      source: source || SOURCE_SET,
      evidenceAreas: card ? evidenceAreas(card) : [],
      inspectorNotes: card ? inspectorNotes(card) : ""
    };
  }

  function evaluateBoundary(result) {
    var fenceLayout = layout();
    var fenceCards = qsa('.fence-card[data-section="fence"]');
    fenceCards.forEach(function (card, index) {
      var meta = (fenceLayout.fences || [])[index] || {};
      if (clean(meta.role).toLowerCase() !== "boundary fence") return;
      var height = num(value("fenceHeight", card));
      var nczCard = qsa(".climbability-card")[index] || null;
      var side = value("nczSideOfBarrier", nczCard);
      var item = itemTitle(card, "Boundary fence");
      if (height === null) {
        result.push(decision("engine-boundary-height-side", "review", "Boundary fence", item, "Boundary fence height / NCZ side", { height: "", side: side }, "Boundary fencing must satisfy the applicable height and NCZ-side arrangement.", "Boundary height has not been recorded.", "Record the effective boundary-fence height and the NCZ side being relied upon.", "QDC MP 3.4 Schedule 1 modifications 6-7 / AS 1926.1 clause 2.3.1", card));
      } else if (height < 1200) {
        result.push(decision("engine-boundary-height-side", "fail", "Boundary fence", item, "Boundary fence height / NCZ side", { height: height, side: side }, "A boundary fence may be below 1800mm only if it is at least 1200mm and the NCZ is on the outside.", "Recorded effective height is below 1200mm.", "Increase or otherwise rectify the boundary barrier and reassess the complete NCZ arrangement.", "QDC MP 3.4 Schedule 1 modifications 6-7 / AS 1926.1 clause 2.3.1", card));
      } else if (height < 1800) {
        if (side === "Outside pool area") {
          result.push(decision("engine-boundary-height-side", "pass", "Boundary fence", item, "Boundary fence height / NCZ side", { height: height, side: side }, "A 1200-1799mm boundary fence can comply when the NCZ is located outside.", "Recorded height and NCZ side match the Queensland modification.", "", "QDC MP 3.4 Schedule 1 modifications 6-7 / AS 1926.1 clause 2.3.1", card));
        } else if (side) {
          result.push(decision("engine-boundary-height-side", "fail", "Boundary fence", item, "Boundary fence height / NCZ side", { height: height, side: side }, "A boundary fence below 1800mm requires the NCZ on the outside.", "The recorded NCZ side is not the required outside arrangement.", "Provide the outside NCZ arrangement or increase/reconfigure the boundary barrier and reassess.", "QDC MP 3.4 Schedule 1 modifications 6-7 / AS 1926.1 clause 2.3.1", card));
        } else {
          result.push(decision("engine-boundary-height-side", "review", "Boundary fence", item, "Boundary fence height / NCZ side", { height: height, side: "" }, "A boundary fence below 1800mm requires the NCZ on the outside.", "The NCZ side is not yet recorded.", "Record and inspect the outside NCZ before reaching the compliance decision.", "QDC MP 3.4 Schedule 1 modifications 6-7 / AS 1926.1 clause 2.3.1", card));
        }
      }
    });

    qsa(".boundary-card").forEach(function (card) {
      var height = num(value("boundaryFenceHeight", card));
      var side = value("boundaryNczSide", card);
      var item = itemTitle(card, "Boundary fence");
      if (height === null) return;
      if (height < 1200) {
        result.push(decision("engine-boundary-height-side", "fail", "Boundary fence", item, "Boundary fence height / NCZ side", { height: height, side: side }, "Boundary fencing relied upon as a pool barrier must satisfy the applicable minimum height / NCZ arrangement.", "Recorded height is below 1200mm.", "Rectify the boundary barrier and reassess.", "QDC MP 3.4 Schedule 1 modifications 6-7", card));
      } else if (height < 1800 && side !== "Outside pool area") {
        result.push(decision("engine-boundary-height-side", side ? "fail" : "review", "Boundary fence", item, "Boundary fence height / NCZ side", { height: height, side: side }, "A boundary fence from 1200mm to below 1800mm requires an outside NCZ.", side ? "The recorded NCZ side is not the permitted outside arrangement." : "The NCZ side is not recorded.", "Record / provide the outside NCZ or change the barrier arrangement.", "QDC MP 3.4 Schedule 1 modifications 6-7", card));
      }
    });
  }

  function evaluateMesh(result) {
    qsa('.fence-card[data-section="fence"]').forEach(function (card) {
      var type = value("fenceType", card).toLowerCase();
      if (!/mesh|chainwire|perforat/.test(type)) return;
      var aperture = num(value("fenceApertureSize", card));
      var height = num(value("fenceHeight", card));
      var top = value("fenceMeshTopStrainer", card);
      var bottom = value("fenceMeshBottomStrainer", card);
      var item = itemTitle(card, "Mesh fence");
      if (aperture === null || height === null) {
        result.push(decision("engine-mesh-aperture-height", "review", "Fence", item, "Mesh aperture / effective height", { aperture: aperture, height: height }, "Mesh/perforated fencing uses different minimum heights depending on aperture size.", "Aperture size and/or effective height is missing.", "Record both measurements before determining compliance.", "AS 1926.1-2007 clause 2.3.2; QDC MP 3.4 applies the Queensland modifications", card));
      } else if (aperture > 100) {
        result.push(decision("engine-mesh-aperture-height", "fail", "Fence", item, "Mesh aperture / effective height", { aperture: aperture, height: height }, "Perforated/mesh apertures greater than 100mm are not permitted.", "Recorded aperture is greater than 100mm.", "Replace or reconfigure the mesh/perforated barrier and reassess.", "AS 1926.1-2007 clause 2.3.2", card));
      } else {
        var requiredHeight = aperture <= 13 ? 1200 : 1800;
        if (height < requiredHeight) {
          result.push(decision("engine-mesh-aperture-height", "fail", "Fence", item, "Mesh aperture / effective height", { aperture: aperture, height: height, requiredHeight: requiredHeight }, "Mesh apertures up to 13mm require at least 1200mm effective height; apertures over 13mm up to 100mm require at least 1800mm.", "The aperture/height combination does not meet the applicable branch.", "Increase or replace the barrier so the aperture and effective height combination complies.", "AS 1926.1-2007 clause 2.3.2", card));
        } else {
          result.push(decision("engine-mesh-aperture-height", "pass", "Fence", item, "Mesh aperture / effective height", { aperture: aperture, height: height, requiredHeight: requiredHeight }, "Mesh aperture and effective height must satisfy the applicable branch.", "Recorded aperture/height combination satisfies this dimensional branch.", "", "AS 1926.1-2007 clause 2.3.2", card));
        }
      }
      if (top === "No" || bottom === "No") {
        result.push(decision("engine-mesh-strainers", "fail", "Fence", item, "Mesh top / bottom strainer", { top: top, bottom: bottom }, "Mesh fencing must include a strainer wire or rail at the top and bottom.", "A required top or bottom strainer/rail is recorded as absent.", "Provide compliant top and bottom strainer wire/rails and reassess the barrier.", "AS 1926.1-2007 clause 2.3.2", card));
      } else if (!top || !bottom) {
        result.push(decision("engine-mesh-strainers", "review", "Fence", item, "Mesh top / bottom strainer", { top: top, bottom: bottom }, "Mesh fencing must include a strainer wire or rail at the top and bottom.", "Presence of both required strainers/rails has not been fully recorded.", "Inspect and record the top and bottom strainer/rail arrangement.", "AS 1926.1-2007 clause 2.3.2", card));
      }
    });
  }

  function evaluateNczObjects(result) {
    qsa(".climbability-card").forEach(function (card) {
      var distance = num(value("nczDistance", card));
      var horizontal = value("nczHorizontalSurface", card);
      var accessible = value("nczObjectChildAccessible", card);
      var supports = value("nczObjectSupportsChild", card);
      var objectType = value("nczObjectType", card);
      var item = itemTitle(card, "NCZ object");
      if (distance === null) return;
      if (distance >= 900) {
        result.push(decision("engine-ncz-object-assessment", "pass", "NCZ", item, "NCZ object relationship", { distance: distance, horizontalSurfaceOver10mm: horizontal, accessible: accessible, supportsChild: supports, objectType: objectType }, "Potential climbable objects must not create accessible handholds/footholds within the applicable NCZ.", "Recorded object is at least 900mm from the barrier for this assessment.", "", "Queensland PSI Guideline 2024 - NCZ / climbable vegetation; QDC MP 3.4 Schedule 1 modification 8", card));
        return;
      }
      if (horizontal === "Yes" && accessible === "Yes" && supports !== "No") {
        result.push(decision("engine-ncz-object-assessment", "fail", "NCZ", item, "NCZ object relationship", { distance: distance, horizontalSurfaceOver10mm: horizontal, accessible: accessible, supportsChild: supports, objectType: objectType }, "A substantially horizontal surface over 10mm that a young child can use as a handhold/foothold must not compromise the NCZ.", "The object is within 900mm, is recorded as accessible and provides a substantially horizontal climbing surface.", "Remove, relocate, shield or permanently modify the feature so it cannot be used to climb the barrier, then reassess the NCZ.", "Queensland PSI Guideline 2024 - NCZ / climbable vegetation", card));
      } else if (accessible === "No" || supports === "No") {
        result.push(decision("engine-ncz-object-assessment", "pass", "NCZ", item, "NCZ object relationship", { distance: distance, horizontalSurfaceOver10mm: horizontal, accessible: accessible, supportsChild: supports, objectType: objectType }, "The NCZ assessment depends on whether the feature can reasonably be accessed/used by a young child, not distance alone.", "The recorded evidence indicates the feature cannot reasonably be used to support/access climbing.", "", "QDC MP 3.4 Schedule 1 modification 8; Queensland PSI Guideline 2024 - NCZ / climbable vegetation", card));
      } else {
        result.push(decision("engine-ncz-object-assessment", "review", "NCZ", item, "NCZ object relationship", { distance: distance, horizontalSurfaceOver10mm: horizontal, accessible: accessible, supportsChild: supports, objectType: objectType }, "An object inside the 900mm zone requires an assessment of whether it creates a reasonably accessible handhold/foothold or supports climbing.", "The available facts do not establish the required accessibility/climbability conclusion.", "Record whether the object is reasonably accessible to a young child and whether it can support climbing; then make the inspector assessment.", "QDC MP 3.4 Schedule 1 modification 8; Queensland PSI Guideline 2024 - NCZ", card));
      }
    });
  }

  function poolContext() {
    var p = value("poolType").toLowerCase();
    if (p.indexOf("indoor") !== -1) return "indoor";
    if (p.indexOf("outdoor") !== -1 || p.indexOf("in-ground") !== -1 || p.indexOf("above-ground") !== -1 || p.indexOf("spa") !== -1 || p.indexOf("swim spa") !== -1) return "outdoor";
    return "unknown";
  }

  function evaluateDoors(result) {
    var context = poolContext();
    qsa(".barrier-door-card").forEach(function (card) {
      var direct = value("barrierDoorDirectPoolAccess", card);
      var authority = value("barrierDoorAuthorityApplies", card);
      var selfClosing = value("barrierDoorSelfClosing", card);
      var selfLatching = value("barrierDoorSelfLatching", card);
      var swingsAway = value("barrierDoorSwingsAway", card);
      var item = itemTitle(card, "Building access");
      if (direct !== "Yes") return;
      if (context === "outdoor") {
        if (authority === "Yes") {
          result.push(decision("engine-outdoor-direct-door", "review", "Building access", item, "Direct building access", { poolContext: context, directAccess: direct, authorityApplies: authority }, "Direct building access is not ordinarily permitted for an outdoor pool; a verified exemption/performance solution/variation must be assessed strictly within its scope.", "A special authority is recorded as applying, so BarrierCheck will not infer compliance automatically.", "Verify the authority is current, sighted and specifically covers this doorset/access arrangement; record the decision rationale.", "AS 1926.2-2007 clause 4.2 as modified by QDC MP 3.4; Queensland PSI Guideline 2024 - child-resistant doors", card));
        } else {
          result.push(decision("engine-outdoor-direct-door", "fail", "Building access", item, "Direct building access", { poolContext: context, directAccess: direct, authorityApplies: authority }, "Outdoor pool barriers must not permit direct access from the building under the ordinary prescriptive arrangement.", "The recorded doorset provides direct building access to an outdoor pool area and no applicable authority is recorded.", "Provide a compliant barrier arrangement preventing direct access, or obtain/verify any lawful special authority before certification.", "AS 1926.2-2007 clause 4.2 as modified by QDC MP 3.4; Queensland PSI Guideline 2024 - child-resistant doors", card));
        }
      } else if (context === "indoor") {
        if (selfClosing === "Fail" || selfLatching === "Fail" || swingsAway === "No") {
          result.push(decision("engine-indoor-child-resistant-door", "fail", "Building access", item, "Indoor child-resistant doorset", { selfClosing: selfClosing, selfLatching: selfLatching, swingsAway: swingsAway }, "A child-resistant doorset used for indoor-pool access must satisfy the applicable doorset requirements and not open toward the pool area.", "One or more recorded doorset requirements are not satisfied.", "Rectify the doorset operation/latching/swing arrangement and reassess.", "QDC MP 3.4 Schedule 1 modifications 15, 18 and 26; AS 1926.1 clause 2.8 / AS 1926.2 clause 4.4.1", card));
        } else if (!selfClosing || !selfLatching || !swingsAway) {
          result.push(decision("engine-indoor-child-resistant-door", "review", "Building access", item, "Indoor child-resistant doorset", { selfClosing: selfClosing, selfLatching: selfLatching, swingsAway: swingsAway }, "Indoor-pool direct access can use a compliant child-resistant doorset.", "The doorset evidence is incomplete.", "Complete the child-resistant doorset assessment before the final decision.", "QDC MP 3.4 Schedule 1 modifications 15 and 26; AS 1926.2 clause 4.4.1", card));
        }
      } else {
        result.push(decision("engine-door-pool-context", "review", "Building access", item, "Pool context for direct building access", { poolType: value("poolType"), directAccess: direct }, "Whether a doorset can form part of the barrier depends on the indoor/outdoor pool context and any applicable authority.", "Pool context is not sufficiently classified for this direct-access decision.", "Confirm the pool type/context before determining doorset compliance.", "QDC MP 3.4 / AS 1926.2-2007 clauses 4.2 and 4.4.1", card));
      }
    });
  }

  function evaluateWater(result) {
    qsa(".water-barrier-card").forEach(function (card) {
      var depth = num(value("waterBarrierDepth", card));
      var width = num(value("waterBarrierWidth", card));
      var access = value("waterBarrierAccessPrevented", card);
      var intersection = value("waterBarrierIntersectionTreatment", card);
      var surface = value("waterBarrierSurfaceNonClimbable", card);
      var item = itemTitle(card, "Permanent body of water");
      var inputs = { depth: depth, width: width, accessPrevented: access, intersectionTreatment: intersection, returnSurfaceNonClimbable: surface };
      if (depth !== null && depth <= 300) {
        result.push(decision("engine-water-barrier", "fail", "Permanent body of water", item, "Permanent body of water as barrier", inputs, "The water must be continuously more than 300mm deep, at least 1800mm wide adjacent to the protected edge, prevent access over/under, and use compliant intersection treatment.", "Recorded water depth is not more than 300mm.", "Provide a compliant physical barrier or rectify the complete water-body barrier arrangement.", "QDC MP 3.4 Schedule 1 modification 17 / AS 1926.1 clause 2.6.3", card));
      } else if (width !== null && width < 1800) {
        result.push(decision("engine-water-barrier", "fail", "Permanent body of water", item, "Permanent body of water as barrier", inputs, "A body of water relied upon as a barrier must satisfy all prescribed depth, width, access and intersection conditions.", "Recorded adjacent water width is less than 1800mm.", "Provide a compliant physical barrier or rectify the complete water-body barrier arrangement.", "QDC MP 3.4 Schedule 1 modification 17 / AS 1926.1 clause 2.6.3", card));
      } else if (access === "No" || intersection === "No" || surface === "No") {
        result.push(decision("engine-water-barrier", "fail", "Permanent body of water", item, "Permanent body of water as barrier", inputs, "All prescribed water-body barrier conditions must be satisfied.", "One or more access/intersection/surface conditions are recorded as not satisfied.", "Rectify the relevant access or barrier-intersection treatment and reassess the whole water-barrier arrangement.", "QDC MP 3.4 Schedule 1 modification 17 / AS 1926.1 clause 2.6.3", card));
      } else if (depth === null || width === null || !access || !intersection || !surface) {
        result.push(decision("engine-water-barrier", "review", "Permanent body of water", item, "Permanent body of water as barrier", inputs, "A water body can form part of a barrier only when all prescribed conditions are established.", "The record does not yet contain all facts needed to decide this arrangement.", "Record depth, width, access over/under and barrier-intersection treatment before determining compliance.", "QDC MP 3.4 Schedule 1 modification 17 / AS 1926.1 clause 2.6.3", card));
      } else {
        result.push(decision("engine-water-barrier", "pass", "Permanent body of water", item, "Permanent body of water as barrier", inputs, "All prescribed conditions must be satisfied.", "The recorded facts satisfy the decision branches captured by BarrierCheck.", "", "QDC MP 3.4 Schedule 1 modification 17 / AS 1926.1 clause 2.6.3", card));
      }
    });
  }

  function evaluateWindows(result) {
    qsa(".barrier-window-card").forEach(function (card) {
      var h1 = num(value("barrierWindowExternalSillHeight", card));
      var h2 = num(value("barrierWindowInternalSillHeight", card));
      var method = value("barrierWindowProtectionMethod", card);
      var gap = num(value("barrierWindowMaxOpening", card));
      var fixed = value("barrierWindowScreenBarsMeshFixed", card);
      var tools = value("barrierWindowFixingsRequireTools", card);
      var item = itemTitle(card, "Window");
      var inputs = { externalSillH1: h1, internalSillH2: h2, method: method, maximumOpening: gap, screenBarsMeshFixed: fixed, fixingsRequireTools: tools };
      if (h1 !== null && h1 >= 1800) {
        result.push(decision("engine-window-branch", "pass", "Window", item, "Child-resistant window branch", inputs, "The child-resistant openable-window requirements are triggered where the relevant external sill height is below 1800mm.", "Recorded external sill height is at least 1800mm for this branch.", "", "AS 1926.1-2007 clause 2.7", card));
      } else if (h1 !== null && h1 < 1800 && h2 !== null && h2 <= 900) {
        if (method === "Restricted opening" && gap !== null && gap <= 100 && tools === "Pass") {
          result.push(decision("engine-window-branch", "pass", "Window", item, "Child-resistant window branch", inputs, "For this low internal-sill branch, a securely fixed restricted opening of no more than 100mm is one permitted method.", "Recorded restricted-opening measurements and tool-removal evidence satisfy the captured branch.", "", "AS 1926.1-2007 clause 2.7(a)", card));
        } else if (method === "Fixed bars / mesh screen" && fixed === "Pass" && tools === "Pass") {
          result.push(decision("engine-window-branch", "pass", "Window", item, "Child-resistant window branch", inputs, "For this low internal-sill branch, compliant bars/mesh fixed so they require tools for removal is one permitted method.", "Recorded fixed-bars/mesh evidence satisfies the captured branch.", "", "AS 1926.1-2007 clause 2.7(a)", card));
        } else if (method) {
          result.push(decision("engine-window-branch", "fail", "Window", item, "Child-resistant window branch", inputs, "The selected protection method must satisfy all requirements of its applicable branch.", "The recorded measurements/protection evidence do not establish compliance for the selected method.", "Rectify the window protection arrangement and reassess the applicable AS 1926.1 branch.", "AS 1926.1-2007 clause 2.7(a)", card));
        } else {
          result.push(decision("engine-window-branch", "review", "Window", item, "Child-resistant window branch", inputs, "A child-resistant window arrangement is required when the external sill is below 1800mm.", "The protection method is not recorded.", "Record the protection method and required dimensions/fixings.", "AS 1926.1-2007 clause 2.7", card));
        }
      } else if (h1 !== null && h1 < 1800) {
        result.push(decision("engine-window-branch", "review", "Window", item, "Child-resistant window branch", inputs, "Window requirements vary with both external and internal sill heights and the protection arrangement.", "This configuration needs the inspector to apply the applicable sub-branch; BarrierCheck will not infer an unrecorded arrangement.", "Complete the internal sill measurement and applicable window-protection assessment, recording the rationale where a different permitted branch is used.", "AS 1926.1-2007 clause 2.7", card));
      }
    });
  }

  function evaluateRetainingWalls(result) {
    qsa(".retaining-wall-card").forEach(function (card) {
      var relation = value("retainingWallRelation", card);
      var height = num(value("retainingWallHeight", card));
      var slope = value("retainingWallSlopeCompliant", card);
      var intersects = value("retainingWallFenceIntersects", card);
      var treatment = value("retainingWallIntersectionTreatment", card);
      var item = itemTitle(card, "Retaining wall");
      var inputs = { relation: relation, height: height, slopeCompliant: slope, fenceIntersects: intersects, intersectionTreatment: treatment };
      if (intersects === "Yes" && treatment === "No") {
        result.push(decision("engine-retaining-intersection", "fail", "Retaining wall", item, "Fence / retaining-wall intersection", inputs, "Where a fence intersects the retaining wall, the required overhang/return treatment must be provided and must not create climbable handholds/footholds.", "The intersection treatment is recorded as not compliant.", "Provide the applicable 900mm overhang/return arrangement and reassess the surface for climbability.", "AS 1926.1-2007 clause 2.6.2 as modified by QDC MP 3.4 Schedule 1 modification 16", card));
      } else if (intersects === "Yes" && !treatment) {
        result.push(decision("engine-retaining-intersection", "review", "Retaining wall", item, "Fence / retaining-wall intersection", inputs, "Fence/retaining-wall intersections require specific treatment.", "The intersection is present but the treatment has not been recorded.", "Inspect and record the applicable return/overhang treatment.", "AS 1926.1-2007 clause 2.6.2 / QDC MP 3.4", card));
      }

      if (relation === "Above pool level") {
        if (height !== null && height < 1800) {
          result.push(decision("engine-retaining-wall", "fail", "Retaining wall", item, "Retaining wall above pool level", inputs, "A retaining wall above pool level used as the barrier must have an effective height of at least 1800mm including the NCZ and satisfy the applicable slope limit.", "Recorded effective height is below 1800mm.", "Rectify the retaining-wall barrier arrangement and reassess height, slope and NCZ.", "AS 1926.1-2007 clause 2.6.1", card));
        } else if (slope === "No") {
          result.push(decision("engine-retaining-wall", "fail", "Retaining wall", item, "Retaining wall above pool level", inputs, "The applicable retaining wall must satisfy the specified slope relationship.", "Slope requirement is recorded as not satisfied.", "Rectify the wall/barrier arrangement or provide another compliant barrier solution.", "AS 1926.1-2007 clause 2.6.1", card));
        } else if (height === null || !slope) {
          result.push(decision("engine-retaining-wall", "review", "Retaining wall", item, "Retaining wall above pool level", inputs, "Height and slope both form part of the retaining-wall decision.", "The record is incomplete.", "Record effective height and slope assessment.", "AS 1926.1-2007 clause 2.6.1", card));
        }
      } else if (relation === "Below pool level") {
        if (slope === "No") {
          result.push(decision("engine-retaining-wall", "fail", "Retaining wall", item, "Retaining wall below pool level", inputs, "A retaining wall below pool level must satisfy the applicable slope requirement and one of the permitted barrier/NCZ options.", "Slope requirement is recorded as not satisfied.", "Rectify the retaining-wall/barrier arrangement and reassess.", "AS 1926.1-2007 clause 2.6.2", card));
        } else if (!slope || height === null) {
          result.push(decision("engine-retaining-wall", "review", "Retaining wall", item, "Retaining wall below pool level", inputs, "The below-pool retaining-wall clause provides alternative compliance paths that depend on geometry and NCZ treatment.", "Insufficient measurements are recorded to select the applicable branch.", "Complete the height/slope/NCZ assessment and document which permitted branch is relied upon.", "AS 1926.1-2007 clause 2.6.2", card));
        }
      } else if (relation) {
        result.push(decision("engine-retaining-wall", "review", "Retaining wall", item, "Complex retaining-wall arrangement", inputs, "Complex retaining-wall/level-change configurations require the inspector to select and document the applicable standard branch.", "The arrangement is recorded as other/complex.", "Document the applicable clause/geometry and decision rationale.", "AS 1926.1-2007 clause 2.6; QDC MP 3.4", card));
      }
    });
  }

  function evaluateBalconies(result) {
    qsa(".balcony-card").forEach(function (card) {
      var drop = num(value("balconyDropHeight", card));
      var distance = num(value("balconyDistanceToBarrierTop", card));
      var barrier = value("balconyBarrierCompliant", card);
      var ncz = value("balconyNczCompliant", card);
      var item = itemTitle(card, "Balcony");
      if (drop === null && distance === null) return;
      var triggered = (drop !== null && drop < 1800) || (distance !== null && distance < 900);
      var inputs = { dropHeight: drop, distanceToBarrierTop: distance, balconyBarrierCompliant: barrier, balconyNczCompliant: ncz };
      if (triggered && barrier === "Fail") {
        result.push(decision("engine-balcony-geometry", "fail", "Balcony", item, "Balcony geometry / barrier", inputs, "A balcony that projects into the relevant pool area or is within the prescribed relationship to the barrier must satisfy the applicable barrier/NCZ requirements.", "Recorded geometry triggers the balcony requirements and the balcony barrier is recorded as non-compliant.", "Rectify the balcony/barrier arrangement and reassess both barrier and NCZ requirements.", "AS 1926.1-2007 clause 2.9; QDC MP 3.4 Schedule 1 modifications 19-20", card));
      } else if (triggered && (!barrier || !ncz)) {
        result.push(decision("engine-balcony-geometry", "review", "Balcony", item, "Balcony geometry / barrier", inputs, "Triggered balcony configurations require the applicable barrier and/or NCZ assessment.", "The dimensional trigger is present but the compliance evidence is incomplete.", "Complete the balcony barrier and NCZ assessment.", "AS 1926.1-2007 clause 2.9; QDC MP 3.4 Schedule 1 modifications 19-20", card));
      } else if (triggered && ncz === "No") {
        result.push(decision("engine-balcony-geometry", "fail", "Balcony", item, "Balcony geometry / NCZ", inputs, "The additional Queensland balcony NCZ requirement must be satisfied unless a compliant barrier is provided to the balcony.", "Required NCZ arrangement is recorded as not compliant.", "Rectify the balcony/NCZ arrangement and reassess.", "QDC MP 3.4 Schedule 1 modification 19", card));
      }
    });
  }

  function evaluateGates(result) {
    var context = poolContext();
    qsa(".gate-card").forEach(function (card) {
      var type = value("gateType", card).toLowerCase();
      var chameleon = value("gateIsChameleon", card);
      var fixedLeaf = value("gateFixedLeafPermanent", card);
      var leaves = value("gateEachLeafSelfClosesLatches", card);
      var latchHeight = num(value("gateLatchHeight", card));
      var latchPass = value("gateLatchHeightCompliant", card);
      var geometry = value("gateLowerLatchGeometryVerified", card);
      var shield = value("gateLatchShielded", card);
      var reach = value("gateLatchReachThroughGaps", card);
      var item = itemTitle(card, "Gate");
      if (chameleon === "Yes" && context === "outdoor") {
        result.push(decision("engine-chameleon-gate", "fail", "Gate", item, "Chameleon-gate arrangement", { poolContext: context, chameleon: chameleon }, "Chameleon gates are not permitted as part of an outdoor-pool barrier because they provide direct access from the building.", "A chameleon-gate arrangement is recorded at an outdoor pool.", "Replace the access arrangement with a compliant barrier/gate layout that prevents direct building access.", "Queensland PSI Guideline 2024 - Chameleon gates / AS 1926.2 direct-access requirements", card));
      }
      if (type.indexOf("double leaf") !== -1) {
        if (fixedLeaf === "No" || leaves === "No") {
          result.push(decision("engine-double-leaf-gate", "fail", "Gate", item, "Double-leaf gate arrangement", { fixedLeafPermanent: fixedLeaf, eachLeafSelfClosesLatches: leaves }, "A twin-leaf gate requires a permanent fixed leaf/centre fixture arrangement and each operable leaf must self-close and self-latch.", "One or more required twin-leaf conditions are recorded as not satisfied.", "Provide a permanent compliant fixing/centre arrangement and ensure every operable leaf self-closes and self-latches.", "Queensland PSI Guideline 2024 - Leaf (swing) gates", card));
        } else if (!fixedLeaf || !leaves) {
          result.push(decision("engine-double-leaf-gate", "review", "Gate", item, "Double-leaf gate arrangement", { fixedLeafPermanent: fixedLeaf, eachLeafSelfClosesLatches: leaves }, "Twin-leaf gates require specific permanent fixing and self-closing/latching evidence.", "The twin-leaf evidence is incomplete.", "Complete the twin-leaf gate assessment.", "Queensland PSI Guideline 2024 - Leaf (swing) gates", card));
        }
      }
      if (latchHeight !== null && latchHeight < 1500 && latchPass === "Pass") {
        if (geometry === "No" || shield === "Fail" || reach === "Fail") {
          result.push(decision("engine-lower-latch-arrangement", "fail", "Gate", item, "Lower latch arrangement", { latchHeight: latchHeight, geometryVerified: geometry, latchShielded: shield, reachThroughGaps: reach }, "A latch release below the usual 1500mm position can only rely on a permitted arrangement when the required shielding/reach geometry is satisfied.", "The recorded lower-latch arrangement contains a failed geometry/shielding condition.", "Raise the release or rectify the complete lower-latch shielding/reach arrangement and reassess.", "AS 1926.1-2007 clause 2.5.4.3", card));
        } else if (!geometry) {
          result.push(decision("engine-lower-latch-arrangement", "review", "Gate", item, "Lower latch arrangement", { latchHeight: latchHeight, geometryVerified: geometry, latchShielded: shield, reachThroughGaps: reach }, "A lower latch requires the inspector to verify the permitted shielding/reach geometry.", "Latch compliance is marked Pass but the supporting lower-latch geometry has not been recorded.", "Measure/verify the shielding and reach-through geometry and retain the result.", "AS 1926.1-2007 clause 2.5.4.3", card));
        }
      }
    });
  }

  function evaluateStrengthEvidence(result) {
    qsa('.fence-card[data-section="fence"]').forEach(function (card) {
      var conclusion = value("fenceStrengthRigid", card);
      var method = value("fenceStrengthAssessmentMethod", card);
      var notes = value("fenceStrengthTestEvidence", card);
      if (conclusion !== "Pass") return;
      if (!method) {
        result.push(decision("engine-strength-evidence", "review", "Fence", itemTitle(card, "Fence"), "Strength / rigidity evidence", { conclusion: conclusion, method: method, evidence: notes }, "The inspector record should substantiate how strength/rigidity was assessed, particularly where testing or professional judgement is relied upon.", "Strength/rigidity is marked Pass but the assessment method is not recorded.", "Record the visual/manual/instrumented/documentary assessment method and any relevant result.", "AS 1926.1-2007 Section 3; Queensland PSI Guideline 2024 - assessment methods / record keeping", card));
      }
    });
  }

  function evaluateAboveGround(result) {
    qsa(".special-pool-feature-card").forEach(function (card) {
      var type = value("specialPoolFeatureType", card).toLowerCase();
      if (type.indexOf("above-ground") === -1 && type.indexOf("inflatable") === -1) return;
      var access = value("designatedAccessPointEnclosed", card);
      if (access === "No") {
        result.push(decision("engine-above-ground-access", "fail", "Special pool feature", itemTitle(card, "Above-ground pool"), "Designated access point", { designatedAccessPointEnclosed: access }, "An above-ground pool must have a designated access point enclosed by a barrier including a compliant gate, regardless of whether a permanent access ladder is installed.", "The designated access point is recorded as not enclosed by a compliant barrier/gate.", "Provide a compliant enclosed access point and reassess ladder/filter NCZ relationships.", "QDC MP 3.4 Schedule 1 modification 21 / AS 1926.1 clause 2.10", card));
      } else if (!access) {
        result.push(decision("engine-above-ground-access", "review", "Special pool feature", itemTitle(card, "Above-ground pool"), "Designated access point", { designatedAccessPointEnclosed: access }, "Above-ground pools require a designated compliant access point.", "The access-point arrangement has not been recorded.", "Record the designated access-point barrier/gate arrangement.", "QDC MP 3.4 Schedule 1 modification 21 / AS 1926.1 clause 2.10", card));
      }
    });
  }

  function evaluateTemporaryAndDecommissioned(result) {
    qsa(".temporary-fence-card").forEach(function (card) {
      var present = value("temporaryFencingPresent", card);
      var approval = value("temporaryFenceApprovalStatus", card);
      var approvalDate = value("temporaryFenceApprovalDate", card);
      var endDate = value("temporaryFencePeriodEndDate", card);
      if (present === "Pass" && (!approval || approval === "Approval not sighted" || !approvalDate || !endDate)) {
        result.push(decision("engine-temporary-fence-approval", "review", "Temporary fencing", itemTitle(card, "Temporary fencing"), "Temporary fence approval / period", { present: present, approvalStatus: approval, approvalDate: approvalDate, periodEndDate: endDate }, "Temporary fencing is subject to approval and time-period pathways that depend on the work context.", "A temporary fence is being relied upon but its approval/current period is not fully evidenced.", "Sight and record the current approval/inspection status and the applicable period before relying on the temporary fence.", "QDC MP 3.4 Schedule 1 modifications 3-4; Queensland PSI Guideline 2024 - Temporary fencing", card));
      }
    });

    qsa(".decommissioned-pool-card").forEach(function (card) {
      var claimed = value("poolClaimedDecommissioned", card);
      var converted = value("convertedPoolUse", card);
      var finalApproval = value("decommissionFinalApproval", card);
      if ((claimed === "Yes" || converted === "Yes") && finalApproval !== "Yes") {
        result.push(decision("engine-decommission-evidence", "review", "Pool classification", itemTitle(card, "Decommissioned / converted pool"), "Decommissioning / conversion approval", { claimedDecommissioned: claimed, convertedUse: converted, finalApproval: finalApproval, reference: value("decommissionApprovalReference", card) }, "A former swimming pool does not cease to be a swimming pool merely because its current use changes; relevant building work/final approval may be needed to establish the changed status.", "Decommissioning/conversion is being relied upon but final approval is not recorded as sighted.", "Obtain/verify the relevant approval or continue assessing the structure as a regulated pool as applicable.", "Queensland PSI Guideline 2024 - Decommissioning pools / pools converted to fishponds", card));
      }
    });
  }

  function evaluateAuthoritiesAndWorkflow(result) {
    var authorities = readAuthorityRecords();
    authorities.forEach(function (record, index) {
      if (!clean(record.type)) return;
      if (clean(record.verified) !== "Yes" || !clean(record.scope)) {
        result.push(decision("engine-authority-record-" + index, "review", "Authority / approval", "Authority / approval " + (index + 1), "Authority scope / verification", record, "Any exemption, variation, appeal, performance solution or alternative solution relied upon should be obtained, verified and documented with its scope and conditions.", "The authority record is incomplete or not recorded as verified.", "Sight the authority, record its reference/scope/conditions and document exactly how it affects the inspection decision.", "Queensland PSI Guideline 2024 - obtaining relevant facts / record keeping / exemptions, performance solutions and variations", null));
      }
    });

    if (value("nonconformityNoticeRequired") === "Yes" && !value("nonconformityNoticeIssuedDate")) {
      result.push(decision("engine-workflow-nonconformity-date", "review", "Statutory workflow", "Inspection outcome", "Nonconformity notice issue date", { required: "Yes", issuedDate: "" }, "Where a nonconformity notice is required, the statutory issue requirements and information-notice content must be met.", "The inspection records a notice as required but no issue date is stored.", "Record the notice issue date and retain the issued notice/information notice in the inspection file.", "Queensland PSI Guideline 2024 - Nonconformity", null));
    }
    if (value("localGovernmentNotificationRequired") === "Yes" && !value("localGovernmentNotificationDate")) {
      result.push(decision("engine-workflow-local-government", "review", "Statutory workflow", "Inspection outcome", "Local-government notification", { required: "Yes", notificationDate: "" }, "Where the statutory notification trigger arises, the inspector must retain evidence of the local-government notification.", "Notification is marked required but no notification date is stored.", "Complete the required notification and record the date/evidence.", "Queensland PSI Guideline 2024 - Reinspection period", null));
    }
  }

  function evaluateAll() {
    var decisions = [];
    evaluateBoundary(decisions);
    evaluateMesh(decisions);
    evaluateNczObjects(decisions);
    evaluateDoors(decisions);
    evaluateWater(decisions);
    evaluateWindows(decisions);
    evaluateRetainingWalls(decisions);
    evaluateBalconies(decisions);
    evaluateGates(decisions);
    evaluateStrengthEvidence(decisions);
    evaluateAboveGround(decisions);
    evaluateTemporaryAndDecommissioned(decisions);
    evaluateAuthoritiesAndWorkflow(decisions);
    return decisions;
  }

  function findingFromDecision(d) {
    return {
      id: d.id,
      item: d.item,
      field: d.field,
      value: d.inputs && Object.keys(d.inputs).length ? JSON.stringify(d.inputs) : "Fail",
      requirement: d.requirement,
      issue: d.reason,
      risk: d.requirement,
      recommendation: d.action,
      source: d.source,
      inspectorNotes: d.inspectorNotes || "",
      evidenceAreas: d.evidenceAreas || [],
      reportGroupKey: "engine:" + d.category + ":" + d.item,
      engineDerived: true
    };
  }

  function mergedFindings() {
    var base = typeof priorCollectFindings === "function" ? (priorCollectFindings() || []) : [];
    base = base.filter(function (finding) {
      return !(finding && OBSOLETE_ATOMIC_IDS[finding.id]);
    });
    var decisions = evaluateAll();
    decisions.forEach(function (d) {
      if (d.status === "fail") base.push(findingFromDecision(d));
    });
    var seen = {};
    return base.filter(function (finding) {
      var key = [finding.id, finding.item, finding.field].join("|");
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function writeSnapshot(decisions) {
    var field = qs('[name="complianceDecisionSnapshot"]');
    if (!field) return;
    var snapshot = {
      engineVersion: VERSION,
      sourceSet: SOURCE_SET,
      evaluatedAt: new Date().toISOString(),
      authorities: readAuthorityRecords(),
      inspectorRationale: value("complianceDecisionRationale"),
      decisions: decisions,
      counts: {
        pass: decisions.filter(function (d) { return d.status === "pass"; }).length,
        fail: decisions.filter(function (d) { return d.status === "fail"; }).length,
        review: decisions.filter(function (d) { return d.status === "review"; }).length
      }
    };
    field.value = JSON.stringify(snapshot);
    setValue("complianceEngineVersion", VERSION);
  }

  function renderInspectorPanel(decisions) {
    var summary = qs("#summary .section-card") || qs("#summary");
    if (!summary) return;
    var panel = qs("#bcComplianceEnginePanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "bcComplianceEnginePanel";
      panel.className = "bc-engine-panel";
      var heading = qs(".section-heading", summary);
      if (heading && heading.nextSibling) summary.insertBefore(panel, heading.nextSibling);
      else summary.insertBefore(panel, summary.firstChild);
    }
    var fails = decisions.filter(function (d) { return d.status === "fail"; });
    var reviews = decisions.filter(function (d) { return d.status === "review"; });
    var html = '<div class="bc-engine-panel-head"><div><h3>Compliance-engine review</h3><p>Derived Queensland decision checks. Raw inspection answers remain unchanged.</p></div><span class="bc-engine-version">v' + VERSION + '</span></div>' +
      '<div class="bc-engine-counts"><strong>' + fails.length + '</strong> derived failure' + (fails.length === 1 ? '' : 's') + ' · <strong>' + reviews.length + '</strong> review item' + (reviews.length === 1 ? '' : 's') + '</div>';
    if (reviews.length) {
      html += '<div class="bc-engine-review"><h4>Inspector review required</h4><ul>' + reviews.map(function (d) {
        return '<li><strong>' + escapeHtml(d.item) + ' — ' + escapeHtml(d.field) + ':</strong> ' + escapeHtml(d.reason) + ' <em>Action: ' + escapeHtml(d.action) + '</em></li>';
      }).join("") + '</ul></div>';
    }
    if (fails.length) {
      html += '<div class="bc-engine-fails"><h4>Derived non-compliance decisions</h4><ul>' + fails.map(function (d) {
        return '<li><strong>' + escapeHtml(d.item) + ' — ' + escapeHtml(d.field) + ':</strong> ' + escapeHtml(d.reason) + '</li>';
      }).join("") + '</ul></div>';
    }
    if (!fails.length && !reviews.length) html += '<p class="bc-engine-ok">No additional derived failures or unresolved review items were generated from the recorded facts.</p>';
    panel.innerHTML = html;
  }

  function escapeHtml(text) {
    return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function updateEngine() {
    augmentAllCards();
    var decisions = evaluateAll();
    writeSnapshot(decisions);
    renderInspectorPanel(decisions);
  }

  function scheduleUpdate() {
    window.clearTimeout(updateTimer);
    updateTimer = window.setTimeout(function () {
      updateEngine();
      if (typeof window.scheduleCurrentInspectionSave === "function") window.scheduleCurrentInspectionSave(450);
    }, 180);
  }

  function scheduleAugment() {
    if (augmentQueued) return;
    augmentQueued = true;
    window.requestAnimationFrame(function () {
      augmentQueued = false;
      augmentAllCards();
      updateEngine();
    });
  }

  function observeDynamicContainers() {
    [
      "#fenceSections", "#climbabilitySections", "#balconySections", "#retainingWallSections",
      "#boundarySections", "#specialPoolFeatureSections", "#waterBarrierSections",
      "#barrierWindowSections", "#barrierDoorSections", "#gateSectionGroups",
      "#temporaryFenceSections", "#decommissionedPoolSections"
    ].forEach(function (selector) {
      var root = qs(selector);
      if (!root || root.dataset.bcEngineObserved === "1") return;
      root.dataset.bcEngineObserved = "1";
      new MutationObserver(function (mutations) {
        var hasCardChange = mutations.some(function (m) { return m.addedNodes.length || m.removedNodes.length; });
        if (hasCardChange) scheduleAugment();
      }).observe(root, { childList: true });
    });
  }

  function patchLegacyAtomicEvaluation() {
    if (typeof priorEvaluateComplianceForElement !== "function") return;
    window.evaluateComplianceForElement = function (el) {
      if (el && ["boundaryFenceHeight", "waterBarrierDepth", "nczDistance", "nczHorizontalSurface"].indexOf(el.name) !== -1) {
        return null;
      }
      return priorEvaluateComplianceForElement.apply(this, arguments);
    };
  }

  function patchPersistence() {
    if (typeof priorRestoreCardFields === "function") {
      window.restoreCardFields = function (card, fields) {
        augmentCard(card);
        return priorRestoreCardFields.call(this, card, fields);
      };
    }
    if (typeof priorRestoreFields === "function") {
      window.restoreFields = function (fields) {
        ensureStaticAuditFields();
        var result = priorRestoreFields.apply(this, arguments);
        renderAuthorityRecords();
        window.setTimeout(updateEngine, 0);
        return result;
      };
    }
    if (typeof priorClearFormForNewInspection === "function") {
      window.clearFormForNewInspection = function () {
        var result = priorClearFormForNewInspection.apply(this, arguments);
        writeAuthorityRecords([]);
        renderAuthorityRecords();
        window.setTimeout(updateEngine, 0);
        return result;
      };
    }
    if (typeof priorSaveCurrentInspection === "function") {
      window.saveCurrentInspection = function () {
        updateEngine();
        return priorSaveCurrentInspection.apply(this, arguments);
      };
    }
  }

  function patchFindings() {
    if (typeof priorCollectFindings === "function") {
      window.collectFindings = function () {
        return mergedFindings();
      };
    }
  }

  function injectStyles() {
    if (qs("#bcComplianceEngineStyles")) return;
    var style = document.createElement("style");
    style.id = "bcComplianceEngineStyles";
    style.textContent =
      ".bc-engine-helper{display:block;margin-top:5px;color:#667b88;font-size:12px;line-height:1.35}" +
      ".bc-engine-group{border-top:1px dashed #bfd2dc;margin-top:12px;padding-top:12px}" +
      ".bc-authority-editor{margin:0 0 18px}.bc-authority-editor>h4{margin:0 0 5px;color:#153d55}.bc-authority-card{margin:10px 0}" +
      ".bc-engine-panel{margin:12px 0 18px;padding:14px;border:1px solid #c8dce6;border-radius:12px;background:#f8fcfe}" +
      ".bc-engine-panel-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.bc-engine-panel-head h3{margin:0;color:#07365b}.bc-engine-panel-head p{margin:3px 0 0;color:#59717e;font-size:13px}" +
      ".bc-engine-version{font-size:11px;color:#68808d;white-space:nowrap}.bc-engine-counts{margin:10px 0;padding:8px 10px;background:#eef7fb;border-radius:8px}" +
      ".bc-engine-review,.bc-engine-fails{margin-top:10px;padding:10px;border-radius:8px}.bc-engine-review{background:#fff8e8;border:1px solid #f0d79a}.bc-engine-fails{background:#fff0ef;border:1px solid #efc5c1}" +
      ".bc-engine-review h4,.bc-engine-fails h4{margin:0 0 6px}.bc-engine-review ul,.bc-engine-fails ul{margin:0;padding-left:20px}.bc-engine-review li,.bc-engine-fails li{margin:6px 0}.bc-engine-review em{display:block;margin-top:2px;color:#5f6b70}" +
      ".bc-engine-ok{margin:10px 0 0;padding:9px;background:#edf8f0;border-radius:8px;color:#285a36}" +
      ".streamline-hidden[name=complianceAuthorityRecords],.streamline-hidden[name=complianceDecisionSnapshot],.streamline-hidden[name=complianceEngineVersion]{display:none!important}";
    document.head.appendChild(style);
  }

  function normalizeBuildingWorkRuleLabel() {
    qsa('[name="buildingWorkAffectingBarrier"]').forEach(function (el) {
      var span = el.closest(".field") && qs("span", el.closest(".field"));
      if (span) span.textContent = "Building work does not compromise the barrier";
    });
  }

  function bindEvents() {
    document.addEventListener("input", function (event) {
      if (event.target && (event.target.hasAttribute("data-save") || event.target.hasAttribute("data-authority-field"))) scheduleUpdate();
    });
    document.addEventListener("change", function (event) {
      if (!event.target) return;
      if (event.target.name === "fenceType") augmentFence(event.target.closest('.fence-card[data-section="fence"]'));
      if (event.target.hasAttribute("data-save") || event.target.hasAttribute("data-authority-field")) scheduleUpdate();
    });
  }

  function boot() {
    injectStyles();
    ensureStaticAuditFields();
    augmentAllCards();
    normalizeBuildingWorkRuleLabel();
    observeDynamicContainers();
    patchLegacyAtomicEvaluation();
    patchPersistence();
    patchFindings();
    bindEvents();
    updateEngine();
    window.BarrierCheckComplianceEngine = {
      version: VERSION,
      evaluate: evaluateAll,
      refresh: updateEngine,
      readAuthorityRecords: readAuthorityRecords
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();