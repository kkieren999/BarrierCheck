// Compatibility and completion safeguards for the modular inspection-question layer.
(function () {
  "use strict";

  function clean(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function parseJson(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch (error) { return fallback; }
  }

  function field(name) {
    return document.querySelector('[name="' + name + '"]');
  }

  function readLayout() {
    var el = field("barrierLayoutConfig");
    return parseJson(el && el.value, { fences: [], gates: [] });
  }

  function readQuestionConfig() {
    var el = field("barrierQuestionConfig");
    var cfg = parseJson(el && el.value, {});
    cfg.version = cfg.version || "20260810.1";
    cfg.fences = cfg.fences && typeof cfg.fences === "object" ? cfg.fences : {};
    cfg.gates = cfg.gates && typeof cfg.gates === "object" ? cfg.gates : {};
    return cfg;
  }

  function writeQuestionConfig(cfg) {
    var el = field("barrierQuestionConfig");
    if (el) el.value = JSON.stringify(cfg);
  }

  function dispatchChange(el) {
    if (!el) return;
    try { el.dispatchEvent(new Event("change", { bubbles: true })); } catch (error) {}
  }

  function setValue(el, value) {
    if (!el) return;
    var next = value === undefined || value === null ? "" : String(value);
    if (el.value === next) return;
    el.value = next;
    dispatchChange(el);
  }

  function fenceMeta(cfg, id) {
    if (!cfg.fences[id]) cfg.fences[id] = {};
    return cfg.fences[id];
  }

  function migrateFenceValuesFromCards() {
    var layout = readLayout();
    var cfg = readQuestionConfig();
    var cards = Array.prototype.slice.call(document.querySelectorAll('.fence-card[data-section="fence"]'));
    var changed = false;

    cards.forEach(function (card, index) {
      var fence = (layout.fences || [])[index];
      if (!fence || !fence.id) return;
      var meta = fenceMeta(cfg, fence.id);
      var type = card.querySelector('[name="fenceType"]');
      var finish = card.querySelector('[name="fenceMaterialFinishSafe"]');
      var clearance = card.querySelector('[name="fenceGroundClearance"]');

      if (!clean(meta.materialType) && type && clean(type.value)) {
        meta.materialType = clean(type.value);
        changed = true;
      }
      if (!clean(meta.finishSafe) && finish && clean(finish.value)) {
        meta.finishSafe = clean(finish.value);
        changed = true;
      }
      if (!clean(meta.groundOpeningObserved) && clearance && clean(clearance.value)) {
        meta.groundOpeningObserved = Number(clearance.value) > 0 ? "Yes" : "No";
        changed = true;
      }
    });

    if (changed) writeQuestionConfig(cfg);
    return changed;
  }

  function clearLegacyBoundaryDefaultUntilHeightKnown() {
    var layout = readLayout();
    var fenceCards = Array.prototype.slice.call(document.querySelectorAll('.fence-card[data-section="fence"]'));
    var nczCards = Array.prototype.slice.call(document.querySelectorAll(".climbability-card"));

    nczCards.forEach(function (card, index) {
      var fence = (layout.fences || [])[index];
      if (!fence || fence.role !== "Boundary fence") return;
      var height = Number(fenceCards[index] && (fenceCards[index].querySelector('[name="fenceHeight"]') || {}).value || 0);
      if (height > 0) return;

      var side = card.querySelector('[name="nczSideOfBarrier"]');
      var correct = card.querySelector('[name="nczCorrectSide"]');
      if (side && side.value === "Inside pool area") setValue(side, "");
      if (correct && correct.value) setValue(correct, "");

      var note = card.querySelector(".bcq-auto-note");
      if (note) {
        note.textContent = "Enter the effective fence height in the matching Fence section first. BarrierCheck will then guide the applicable NCZ side.";
      }
    });
  }

  function patchCompletionRules() {
    var priorBarrierComplete = window.barrierComplete;
    if (typeof priorBarrierComplete === "function" && !priorBarrierComplete.__bcqRequiredWrapped) {
      var wrappedBarrier = function (data) {
        if (!priorBarrierComplete.apply(this, arguments)) return false;
        var fields = data && data.fields || {};
        var layout = parseJson(fields.barrierLayoutConfig || "", { fences: [] });
        var cfg = parseJson(fields.barrierQuestionConfig || "", { fences: {} });
        return (layout.fences || []).length > 0 && (layout.fences || []).every(function (fence) {
          var meta = cfg.fences && cfg.fences[fence.id] || {};
          return !!(
            clean(meta.materialType) &&
            clean(meta.finishSafe) &&
            clean(meta.groundOpeningObserved)
          );
        });
      };
      wrappedBarrier.__bcqRequiredWrapped = true;
      window.barrierComplete = wrappedBarrier;
    }

    var priorNczComplete = window.climbabilityComplete;
    if (typeof priorNczComplete === "function" && !priorNczComplete.__bcqRequiredWrapped) {
      var wrappedNcz = function (data) {
        if (!priorNczComplete.apply(this, arguments)) return false;
        var fields = data && data.fields || {};
        var layout = parseJson(fields.barrierLayoutConfig || "", { fences: [] });
        var cfg = parseJson(fields.barrierQuestionConfig || "", { fences: {} });
        return (layout.fences || []).every(function (fence) {
          var meta = cfg.fences && cfg.fences[fence.id] || {};
          return !!clean(meta.nczClimbables);
        });
      };
      wrappedNcz.__bcqRequiredWrapped = true;
      window.climbabilityComplete = wrappedNcz;
    }

    var priorGateComplete = window.gateComplete;
    if (typeof priorGateComplete === "function" && !priorGateComplete.__bcqRequiredWrapped) {
      var wrappedGate = function () {
        if (!priorGateComplete.apply(this, arguments)) return false;
        var layout = readLayout();
        var cfg = readQuestionConfig();
        var cards = Array.prototype.slice.call(document.querySelectorAll(".gate-card"));
        return cards.every(function (card, index) {
          if (!card.querySelector('[data-bcq-controller="gateGap"]')) return true;
          var gate = (layout.gates || [])[index];
          var meta = gate && cfg.gates && cfg.gates[gate.id] || {};
          return !!clean(meta.gapObserved);
        });
      };
      wrappedGate.__bcqRequiredWrapped = true;
      window.gateComplete = wrappedGate;
    }
  }

  function patchLoadMigration() {
    var originalLoad = window.loadInspectionIntoForm;
    if (typeof originalLoad !== "function" || originalLoad.__bcqMigrationWrapped) return;

    var wrappedLoad = function () {
      var inspection = arguments[0] || {};
      var oldSections = Array.isArray(inspection.fenceSections) ? inspection.fenceSections : [];
      var result = originalLoad.apply(this, arguments);

      window.setTimeout(function () {
        var layout = readLayout();
        var cfg = readQuestionConfig();
        var changed = false;

        (layout.fences || []).forEach(function (fence, index) {
          if (!fence || !fence.id) return;
          var oldFields = oldSections[index] && oldSections[index].fields || {};
          var meta = fenceMeta(cfg, fence.id);
          if (!clean(meta.materialType) && clean(oldFields.fenceType)) {
            meta.materialType = clean(oldFields.fenceType);
            changed = true;
          }
          if (!clean(meta.finishSafe) && clean(oldFields.fenceMaterialFinishSafe)) {
            meta.finishSafe = clean(oldFields.fenceMaterialFinishSafe);
            changed = true;
          }
          if (!clean(meta.groundOpeningObserved) && clean(oldFields.fenceGroundClearance)) {
            meta.groundOpeningObserved = Number(oldFields.fenceGroundClearance) > 0 ? "Yes" : "No";
            changed = true;
          }
        });

        if (changed) writeQuestionConfig(cfg);
        migrateFenceValuesFromCards();
        clearLegacyBoundaryDefaultUntilHeightKnown();
      }, 0);

      return result;
    };
    wrappedLoad.__bcqMigrationWrapped = true;
    window.loadInspectionIntoForm = wrappedLoad;
  }

  function refreshSafeguards() {
    migrateFenceValuesFromCards();
    clearLegacyBoundaryDefaultUntilHeightKnown();
  }

  function boot() {
    patchCompletionRules();
    patchLoadMigration();
    window.setTimeout(refreshSafeguards, 0);

    document.addEventListener("change", function (event) {
      if (event.target && event.target.matches('[name="fenceHeight"], [data-fence-field="role"], [name="nczSideOfBarrier"]')) {
        window.setTimeout(refreshSafeguards, 0);
      }
    });

    var observer = new MutationObserver(function () {
      window.setTimeout(refreshSafeguards, 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
