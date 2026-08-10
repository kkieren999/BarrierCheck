// BarrierCheck modular on-site question rules.
// Uses Barrier Overview + recorded measurements to show only questions that apply.
// The legacy compliance rule bank remains the source of pass/fail findings.
(function () {
  "use strict";

  var VERSION = "20260810.1";
  var saveTimer = null;
  var observer = null;
  var syncing = false;

  var MATERIALS = ["Aluminium", "Glass", "Timber", "Chainwire / mesh", "Masonry", "Other"];

  function clean(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function esc(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function parseJson(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch (error) { return fallback; }
  }

  function layoutField() {
    return document.querySelector('[name="barrierLayoutConfig"]');
  }

  function layout() {
    return parseJson(layoutField() && layoutField().value, { fences: [], gates: [], components: {} });
  }

  function configField() {
    var field = document.querySelector('[name="barrierQuestionConfig"]');
    if (field) return field;
    var anchor = layoutField();
    if (!anchor || !anchor.parentNode) return null;
    field = document.createElement("textarea");
    field.name = "barrierQuestionConfig";
    field.setAttribute("data-save", "");
    field.className = "streamline-hidden";
    field.setAttribute("aria-hidden", "true");
    field.tabIndex = -1;
    anchor.parentNode.insertBefore(field, anchor.nextSibling);
    return field;
  }

  function readConfig() {
    var field = configField();
    var parsed = parseJson(field && field.value, {});
    parsed.version = VERSION;
    parsed.fences = parsed.fences && typeof parsed.fences === "object" ? parsed.fences : {};
    parsed.gates = parsed.gates && typeof parsed.gates === "object" ? parsed.gates : {};
    return parsed;
  }

  function writeConfig(cfg) {
    var field = configField();
    if (field) field.value = JSON.stringify(cfg);
  }

  function fenceMeta(cfg, fenceId) {
    if (!cfg.fences[fenceId]) cfg.fences[fenceId] = {};
    return cfg.fences[fenceId];
  }

  function gateMeta(cfg, gateId) {
    if (!cfg.gates[gateId]) cfg.gates[gateId] = {};
    return cfg.gates[gateId];
  }

  function dispatchChange(el) {
    if (!el) return;
    try { el.dispatchEvent(new Event("change", { bubbles: true })); } catch (error) {}
  }

  function setValue(el, value, notify) {
    if (!el) return;
    var next = value === undefined || value === null ? "" : String(value);
    if (el.value === next) return;
    el.value = next;
    if (notify) dispatchChange(el);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (window.inspectionStarted && typeof window.saveCurrentInspection === "function") {
        window.saveCurrentInspection(false);
      }
    }, 220);
  }

  function injectStyles() {
    if (document.getElementById("barrierCheckModularQuestionStyles")) return;
    var style = document.createElement("style");
    style.id = "barrierCheckModularQuestionStyles";
    style.textContent = [
      ".bcq-hidden-source{display:none!important}",
      ".bcq-derived-note{display:block;margin-top:6px;color:#607681;font-size:.76rem;line-height:1.35}",
      ".bcq-auto-note{grid-column:1/-1;margin:0;padding:9px 11px;border:1px solid #d9e8ef;border-radius:10px;background:#f5fbfe;color:#476775;font-size:.8rem;line-height:1.4}",
      ".bcq-controller{border:1px solid #dce8ed;border-radius:12px;padding:10px;background:#fbfeff}",
      ".bcq-controller span{margin-bottom:6px}",
      ".bcq-not-applicable{display:none!important}",
      ".bcq-overview-note{grid-column:1/-1;color:#6d7f88;font-size:.75rem;margin:-2px 0 2px}",
      ".bcq-recommendation{margin-top:8px;padding:9px 10px;border-radius:10px;background:#eef8fd;border:1px solid #d5eaf3;color:#426879;font-size:.8rem}",
      ".bcq-derived-select[disabled]{opacity:.8;background:#f4f7f9}",
      "@media(max-width:720px){.bcq-controller{padding:9px}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function optionMarkup(options, selected, blank) {
    var html = blank ? '<option value="">' + esc(blank) + "</option>" : "";
    options.forEach(function (item) {
      html += '<option' + (item === selected ? " selected" : "") + ">" + esc(item) + "</option>";
    });
    return html;
  }

  function ensureOverviewFields() {
    var l = layout();
    var cfg = readConfig();
    var rows = Array.prototype.slice.call(document.querySelectorAll("#streamlineFenceEditors [data-fence-id]"));

    rows.forEach(function (row, index) {
      var fence = (l.fences || [])[index] || {};
      var id = row.getAttribute("data-fence-id") || fence.id;
      if (!id) return;
      var meta = fenceMeta(cfg, id);
      var grid = row.querySelector(".streamline-editor-grid");
      if (!grid) return;

      var material = grid.querySelector('[data-bcq-field="materialType"]');
      if (!material) {
        var materialLabel = document.createElement("label");
        materialLabel.className = "field";
        materialLabel.innerHTML = '<span>Fence material / type</span><select data-bcq-field="materialType">' +
          optionMarkup(MATERIALS, meta.materialType || "", "Select type") + "</select>";
        grid.appendChild(materialLabel);
        material = materialLabel.querySelector("select");
      }
      setValue(material, meta.materialType || "", false);

      var finish = grid.querySelector('[data-bcq-field="finishSafe"]');
      if (!finish) {
        var finishLabel = document.createElement("label");
        finishLabel.className = "field";
        finishLabel.innerHTML = '<span>Fence material / finish safe</span><select data-bcq-field="finishSafe">' +
          optionMarkup(["Pass", "Fail", "N/A"], meta.finishSafe || "", "Select result") + "</select>";
        grid.appendChild(finishLabel);
        finish = finishLabel.querySelector("select");
      }
      setValue(finish, meta.finishSafe || "", false);

      if (!grid.querySelector(".bcq-overview-note")) {
        var note = document.createElement("div");
        note.className = "bcq-overview-note";
        note.textContent = "These fence details are entered once here and carried into the Fence and NCZ checks.";
        grid.appendChild(note);
      }
    });

    writeConfig(cfg);
  }

  function valueLabel(control) {
    return control && control.closest ? control.closest("label.field") : null;
  }

  function groupByHeading(card, headingText) {
    var groups = Array.prototype.slice.call(card.querySelectorAll(".details-group.numbered-group"));
    return groups.find(function (group) {
      var h = group.querySelector(".group-title-row h3");
      return h && clean(h.textContent).toLowerCase().indexOf(headingText.toLowerCase()) !== -1;
    }) || null;
  }

  function setGroupNumber(group, number) {
    var badge = group && group.querySelector(".group-number");
    if (badge) badge.textContent = number;
  }

  function ensureGroundController(card, meta) {
    var clearance = card.querySelector('[name="fenceGroundClearance"]');
    var label = valueLabel(clearance);
    if (!clearance || !label || !label.parentNode) return;

    var controller = card.querySelector('[data-bcq-controller="groundOpening"]');
    if (!controller) {
      controller = document.createElement("label");
      controller.className = "field bcq-controller";
      controller.setAttribute("data-bcq-controller", "groundOpening");
      controller.innerHTML = '<span>Opening below barrier observed?</span><select data-bcq-ground-observed>' +
        optionMarkup(["No", "Yes"], meta.groundOpeningObserved || "", "Select") +
        '</select><small class="bcq-derived-note">If there is no opening, you do not need to enter a ground-clearance measurement.</small>';
      label.parentNode.insertBefore(controller, label);
    }
    var select = controller.querySelector("[data-bcq-ground-observed]");
    setValue(select, meta.groundOpeningObserved || "", false);

    if (meta.groundOpeningObserved === "No") {
      label.classList.add("bcq-not-applicable");
      if (!clearance.value || clearance.dataset.bcqAutoZero === "1") {
        clearance.dataset.bcqAutoZero = "1";
        setValue(clearance, "0", true);
      }
    } else if (meta.groundOpeningObserved === "Yes") {
      label.classList.remove("bcq-not-applicable");
      if (clearance.dataset.bcqAutoZero === "1") {
        clearance.dataset.bcqAutoZero = "0";
        setValue(clearance, "", true);
      }
    } else {
      label.classList.add("bcq-not-applicable");
    }
  }

  function applyMaterialQuestions(card, material) {
    var aperture = card.querySelector('[name="fenceApertureSize"]');
    var apertureLabel = valueLabel(aperture);
    var showAperture = /mesh|chainwire/i.test(material || "");
    if (apertureLabel) apertureLabel.classList.toggle("bcq-not-applicable", !showAperture);
    if (aperture && !showAperture && aperture.value) setValue(aperture, "", true);

    var fixings = card.querySelector('[name="fenceFixingsSecure"]');
    var fixingsLabel = valueLabel(fixings);
    var span = fixingsLabel && fixingsLabel.querySelector(":scope > span");
    if (span) {
      if (material === "Glass") span.textContent = "Panels / spigots / fixings secure";
      else if (material === "Masonry") span.textContent = "Wall / construction secure";
      else if (/mesh|chainwire/i.test(material || "")) span.textContent = "Posts / frame / mesh fixings secure";
      else span.textContent = "Posts / rails / fixings secure";
    }
  }

  function syncFenceCards() {
    var l = layout();
    var cfg = readConfig();
    var cards = Array.prototype.slice.call(document.querySelectorAll('.fence-card[data-section="fence"]'));

    cards.forEach(function (card, index) {
      var fence = (l.fences || [])[index];
      if (!fence) return;
      var meta = fenceMeta(cfg, fence.id);

      var identity = groupByHeading(card, "Identity / Location");
      if (identity) identity.classList.add("bcq-hidden-source");

      var measurement = groupByHeading(card, "Measurements / Physical Compliance");
      var strength = groupByHeading(card, "Strength / Condition");
      setGroupNumber(measurement, "A");
      setGroupNumber(strength, "B");

      var type = card.querySelector('[name="fenceType"]');
      var finish = card.querySelector('[name="fenceMaterialFinishSafe"]');
      if (type) setValue(type, meta.materialType || "", true);
      if (finish) setValue(finish, meta.finishSafe || "", true);

      ensureGroundController(card, meta);
      applyMaterialQuestions(card, meta.materialType || "");

      var summary = card.querySelector(".streamline-card-summary");
      if (summary && !summary.querySelector(".bcq-summary-meta")) {
        var small = document.createElement("small");
        small.className = "streamline-defined-note bcq-summary-meta";
        summary.querySelector(".fence-card-head").appendChild(small);
      }
      var summaryMeta = summary && summary.querySelector(".bcq-summary-meta");
      if (summaryMeta) {
        var bits = [fence.role, meta.materialType].filter(Boolean);
        summaryMeta.textContent = bits.join(" • ");
      }
    });
  }

  function ensureNczFeatureController(card, meta) {
    var group = groupByHeading(card, "Climbable features / clear area");
    var grid = group && group.querySelector(".form-grid");
    if (!grid) return;
    var controller = grid.querySelector('[data-bcq-controller="climbables"]');
    if (!controller) {
      controller = document.createElement("label");
      controller.className = "field full bcq-controller";
      controller.setAttribute("data-bcq-controller", "climbables");
      controller.innerHTML = '<span>Potential climbable features present near this fence?</span><select data-bcq-ncz-climbables>' +
        optionMarkup(["No", "Yes"], meta.nczClimbables || "", "Select") +
        '</select><small class="bcq-derived-note">Select No when there are no nearby objects, vegetation, steps, taps or raised garden beds that need individual assessment.</small>';
      grid.insertBefore(controller, grid.firstChild);
    }
    setValue(controller.querySelector("[data-bcq-ncz-climbables]"), meta.nczClimbables || "", false);

    var detailedNames = [
      "nczVegetationNonClimbable", "nczObjectsRemoved", "stepsLedgesRaisedAreasClear",
      "tapsPowerOutletsAssessed", "raisedGardenBedsAssessed"
    ];

    detailedNames.forEach(function (name) {
      var control = card.querySelector('[name="' + name + '"]');
      var label = valueLabel(control);
      var show = meta.nczClimbables === "Yes";
      if (label) label.classList.toggle("bcq-not-applicable", !show);
      if (!show && meta.nczClimbables === "No" && control) setValue(control, "N/A", true);
      if (show && control && control.value === "N/A" && control.dataset.bcqAutoNa === "1") setValue(control, "", true);
      if (!show && meta.nczClimbables === "No" && control) control.dataset.bcqAutoNa = "1";
    });
  }

  function ensureNczRuleNote(card) {
    var setup = groupByHeading(card, "Fence run / NCZ location");
    var grid = setup && setup.querySelector(".form-grid");
    if (!grid) return null;
    var note = grid.querySelector(".bcq-auto-note");
    if (!note) {
      note = document.createElement("div");
      note.className = "bcq-auto-note";
      grid.insertBefore(note, grid.firstChild);
    }
    return note;
  }

  function applyNczSideLogic(card, fence, fenceCard, meta) {
    var heightControl = fenceCard && fenceCard.querySelector('[name="fenceHeight"]');
    var height = Number(heightControl && heightControl.value || 0);
    var side = card.querySelector('[name="nczSideOfBarrier"]');
    var correctSide = card.querySelector('[name="nczCorrectSide"]');
    var correctLabel = valueLabel(correctSide);
    var note = ensureNczRuleNote(card);

    if (correctLabel) correctLabel.classList.add("bcq-not-applicable");

    if (height > 0 && height < 1800) {
      setValue(side, "Outside pool area", true);
      if (side) {
        side.disabled = true;
        side.classList.add("bcq-derived-select");
      }
      setValue(correctSide, "Pass", true);
      if (note) note.textContent = "NCZ side derived from the recorded fence height: below 1800 mm, assess the NCZ on the outside (non-pool side) of the barrier.";
    } else if (height >= 1800) {
      if (side) {
        side.disabled = false;
        side.classList.remove("bcq-derived-select");
      }
      if (side && side.value && side.value !== "Both / requires assessment") setValue(correctSide, "Pass", true);
      else setValue(correctSide, "", true);
      if (note) note.textContent = (fence.role === "Boundary fence" ? "Boundary fence is 1800 mm or higher. " : "") +
        "Select the NCZ arrangement being relied upon (inside or outside) and inspect that side.";
    } else {
      if (side) {
        side.disabled = false;
        side.classList.remove("bcq-derived-select");
      }
      if (note) note.textContent = "Enter the effective fence height in the matching Fence section first. BarrierCheck will then guide the applicable NCZ side.";
    }

    var required = card.querySelector('[name="additionalClearAreaRequired"]');
    var maintained = card.querySelector('[name="additionalClearAreaMaintained"]');
    var requiredLabel = valueLabel(required);
    var maintainedLabel = valueLabel(maintained);
    if (side && side.value === "Outside pool area") {
      setValue(required, "Yes", true);
      if (requiredLabel) requiredLabel.classList.add("bcq-not-applicable");
      if (maintainedLabel) maintainedLabel.classList.remove("bcq-not-applicable");
    } else if (side && side.value === "Inside pool area") {
      setValue(required, "N/A", true);
      setValue(maintained, "N/A", true);
      if (requiredLabel) requiredLabel.classList.add("bcq-not-applicable");
      if (maintainedLabel) maintainedLabel.classList.add("bcq-not-applicable");
    } else {
      if (requiredLabel) requiredLabel.classList.remove("bcq-not-applicable");
      if (maintainedLabel) maintainedLabel.classList.remove("bcq-not-applicable");
    }
  }

  function syncNczCards() {
    var l = layout();
    var cfg = readConfig();
    var cards = Array.prototype.slice.call(document.querySelectorAll(".climbability-card"));
    var fenceCards = Array.prototype.slice.call(document.querySelectorAll('.fence-card[data-section="fence"]'));

    cards.forEach(function (card, index) {
      var fence = (l.fences || [])[index];
      if (!fence) return;
      var meta = fenceMeta(cfg, fence.id);
      applyNczSideLogic(card, fence, fenceCards[index], meta);
      ensureNczFeatureController(card, meta);

      var run = card.querySelector('[name="nczLocation"]');
      var runLabel = valueLabel(run);
      if (runLabel) runLabel.classList.add("bcq-not-applicable");
    });
  }

  function labelWithText(root, expression) {
    var labels = Array.prototype.slice.call(root.querySelectorAll("label.field"));
    return labels.find(function (label) {
      var span = label.querySelector(":scope > span");
      return span && expression.test(clean(span.textContent));
    }) || null;
  }

  function ensureGateGapController(card, meta) {
    var gapLabel = labelWithText(card, /gap.*(under|below)|(?:under|below).*gap/i);
    if (!gapLabel) return;
    var gapControl = gapLabel.querySelector("input[type=number]");
    if (!gapControl || !gapLabel.parentNode) return;

    var controller = card.querySelector('[data-bcq-controller="gateGap"]');
    if (!controller) {
      controller = document.createElement("label");
      controller.className = "field bcq-controller";
      controller.setAttribute("data-bcq-controller", "gateGap");
      controller.innerHTML = '<span>Opening below closed gate observed?</span><select data-bcq-gate-gap-observed>' +
        optionMarkup(["No", "Yes"], meta.gapObserved || "", "Select") +
        '</select><small class="bcq-derived-note">Only measure the opening when one is present.</small>';
      gapLabel.parentNode.insertBefore(controller, gapLabel);
    }
    setValue(controller.querySelector("[data-bcq-gate-gap-observed]"), meta.gapObserved || "", false);

    if (meta.gapObserved === "No") {
      gapLabel.classList.add("bcq-not-applicable");
      if (!gapControl.value || gapControl.dataset.bcqAutoZero === "1") {
        gapControl.dataset.bcqAutoZero = "1";
        setValue(gapControl, "0", true);
      }
    } else if (meta.gapObserved === "Yes") {
      gapLabel.classList.remove("bcq-not-applicable");
      if (gapControl.dataset.bcqAutoZero === "1") {
        gapControl.dataset.bcqAutoZero = "0";
        setValue(gapControl, "", true);
      }
    } else {
      gapLabel.classList.add("bcq-not-applicable");
    }
  }

  function syncGateCards() {
    var l = layout();
    var cfg = readConfig();
    var cards = Array.prototype.slice.call(document.querySelectorAll(".gate-card"));
    cards.forEach(function (card, index) {
      var gate = (l.gates || [])[index];
      if (!gate) return;
      var meta = gateMeta(cfg, gate.id);
      var loc = card.querySelector('[name="gateLocation"]');
      var locLabel = valueLabel(loc);
      if (locLabel) locLabel.classList.add("bcq-not-applicable");
      ensureGateGapController(card, meta);
    });
  }

  function applyDetailsDrivenSuggestions() {
    var poolType = document.querySelector('[name="poolType"]');
    if (!poolType) return;
    var value = clean(poolType.value).toLowerCase();
    if (value.indexOf("above-ground") !== -1) {
      var checkbox = document.querySelector('[data-component-key="special"]');
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        dispatchChange(checkbox);
      }
    }

    var componentBlock = document.getElementById("streamlineComponentEditors");
    if (componentBlock) {
      var existing = componentBlock.parentElement && componentBlock.parentElement.querySelector(".bcq-recommendation");
      if (value.indexOf("above-ground") !== -1) {
        if (!existing) {
          existing = document.createElement("div");
          existing.className = "bcq-recommendation";
          componentBlock.parentElement.appendChild(existing);
        }
        existing.textContent = "Above-ground pool selected in Details — the special / above-ground barrier component checks have been enabled.";
      } else if (existing) {
        existing.remove();
      }
    }
  }

  function syncAll() {
    if (syncing) return;
    syncing = true;
    try {
      ensureOverviewFields();
      syncFenceCards();
      syncNczCards();
      syncGateCards();
      applyDetailsDrivenSuggestions();
      writeConfig(readConfig());
      if (typeof window.updateRequiredFieldMarkers === "function") window.updateRequiredFieldMarkers();
      if (typeof window.refreshSummary === "function") window.refreshSummary();
    } finally {
      syncing = false;
    }
  }

  function handleConfigChange(event) {
    var target = event.target;
    var cfg = readConfig();
    var l = layout();

    var fenceRow = target.closest && target.closest("#streamlineFenceEditors [data-fence-id]");
    if (fenceRow && target.matches("[data-bcq-field]")) {
      var fenceId = fenceRow.getAttribute("data-fence-id");
      var meta = fenceMeta(cfg, fenceId);
      meta[target.getAttribute("data-bcq-field")] = target.value;
      writeConfig(cfg);
      syncAll();
      scheduleSave();
      return;
    }

    var fenceCard = target.closest && target.closest('.fence-card[data-section="fence"]');
    if (fenceCard && target.matches("[data-bcq-ground-observed]")) {
      var cards = Array.prototype.slice.call(document.querySelectorAll('.fence-card[data-section="fence"]'));
      var index = cards.indexOf(fenceCard);
      var fence = (l.fences || [])[index];
      if (fence) {
        fenceMeta(cfg, fence.id).groundOpeningObserved = target.value;
        writeConfig(cfg);
        syncAll();
        scheduleSave();
      }
      return;
    }

    var nczCard = target.closest && target.closest(".climbability-card");
    if (nczCard && target.matches("[data-bcq-ncz-climbables]")) {
      var nczCards = Array.prototype.slice.call(document.querySelectorAll(".climbability-card"));
      var nczIndex = nczCards.indexOf(nczCard);
      var nczFence = (l.fences || [])[nczIndex];
      if (nczFence) {
        fenceMeta(cfg, nczFence.id).nczClimbables = target.value;
        writeConfig(cfg);
        syncAll();
        scheduleSave();
      }
      return;
    }

    var gateCard = target.closest && target.closest(".gate-card");
    if (gateCard && target.matches("[data-bcq-gate-gap-observed]")) {
      var gateCards = Array.prototype.slice.call(document.querySelectorAll(".gate-card"));
      var gateIndex = gateCards.indexOf(gateCard);
      var gate = (l.gates || [])[gateIndex];
      if (gate) {
        gateMeta(cfg, gate.id).gapObserved = target.value;
        writeConfig(cfg);
        syncAll();
        scheduleSave();
      }
      return;
    }

    if (target.matches('[name="fenceHeight"], [name="nczSideOfBarrier"], [name="poolType"], [data-fence-field="role"], [data-fence-field="location"], [data-component-key]')) {
      window.setTimeout(function () { syncAll(); }, 0);
    }
  }

  function pruneDeletedMetadata() {
    var l = layout();
    var cfg = readConfig();
    var fenceIds = (l.fences || []).map(function (f) { return f.id; });
    var gateIds = (l.gates || []).map(function (g) { return g.id; });
    Object.keys(cfg.fences).forEach(function (id) { if (fenceIds.indexOf(id) === -1) delete cfg.fences[id]; });
    Object.keys(cfg.gates).forEach(function (id) { if (gateIds.indexOf(id) === -1) delete cfg.gates[id]; });
    writeConfig(cfg);
  }

  function patchLifecycle() {
    var originalStart = window.startNewInspection;
    if (typeof originalStart === "function" && !originalStart.__bcqWrapped) {
      var wrappedStart = function () {
        var result = originalStart.apply(this, arguments);
        var field = configField();
        if (field) field.value = JSON.stringify({ version: VERSION, fences: {}, gates: {} });
        window.setTimeout(syncAll, 0);
        return result;
      };
      wrappedStart.__bcqWrapped = true;
      window.startNewInspection = wrappedStart;
    }

    var originalLoad = window.loadInspectionIntoForm;
    if (typeof originalLoad === "function" && !originalLoad.__bcqWrapped) {
      var wrappedLoad = function () {
        var result = originalLoad.apply(this, arguments);
        window.setTimeout(syncAll, 0);
        return result;
      };
      wrappedLoad.__bcqWrapped = true;
      window.loadInspectionIntoForm = wrappedLoad;
    }
  }

  function boot() {
    injectStyles();
    configField();
    patchLifecycle();
    syncAll();

    document.addEventListener("change", handleConfigChange);
    document.addEventListener("input", function (event) {
      if (event.target && event.target.matches('[name="fenceHeight"]')) {
        window.setTimeout(syncAll, 0);
      }
    });

    observer = new MutationObserver(function () {
      pruneDeletedMetadata();
      window.setTimeout(syncAll, 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
