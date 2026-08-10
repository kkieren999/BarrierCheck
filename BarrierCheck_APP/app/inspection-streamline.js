// BarrierCheck inspection workflow streamlining layer.
// Loaded after the legacy inspection engine so the existing Firebase/report
// behaviour is preserved while the on-site workflow is simplified.
(function () {
  "use strict";

  var STREAMLINE_VERSION = "20260810.1";
  var layoutState = null;
  var layoutSaveTimer = null;
  var addressAbortController = null;
  var addressTimer = null;
  var syncingGateCards = false;

  var FENCE_LOCATIONS = [
    "Front",
    "Rear",
    "Left",
    "Right",
    "House side",
    "Patio / deck side",
    "Neighbour side",
    "Other / Custom"
  ];

  var FENCE_ROLES = [
    "Internal pool fence",
    "Boundary fence",
    "Building-side fence",
    "Other"
  ];

  var GATE_LOCATIONS = [
    "Front",
    "Rear",
    "Left",
    "Right",
    "House side",
    "Patio / deck side",
    "Side access",
    "Other / Custom"
  ];

  var COMPONENTS = [
    { key: "balcony", label: "Balcony / raised platform", match: "Balcony" },
    { key: "retaining", label: "Retaining wall / level change", match: "Retaining Wall" },
    { key: "special", label: "Above-ground / infinity / special pool feature", match: "Above-Ground" },
    { key: "boundary", label: "Boundary fence / neighbour-side checks", match: "Boundary Fence" },
    { key: "water", label: "Permanent body of water", match: "Permanent Body of Water" },
    { key: "windows", label: "Windows forming part of barrier", match: "Windows Forming Part" },
    { key: "doors", label: "Doors / building access forming part of barrier", match: "Doors / Building Access" }
  ];

  function esc(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function uid(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
  }

  function optionMarkup(options, selected, blankLabel) {
    var html = blankLabel !== undefined ? '<option value="">' + esc(blankLabel) + "</option>" : "";
    options.forEach(function (option) {
      html += '<option value="' + esc(option) + '"' + (option === selected ? " selected" : "") + ">" + esc(option) + "</option>";
    });
    return html;
  }

  function normaliseLayout(input) {
    var source = input && typeof input === "object" ? input : {};
    var fences = Array.isArray(source.fences) ? source.fences : [];
    var gates = Array.isArray(source.gates) ? source.gates : [];
    var components = source.components && typeof source.components === "object" ? source.components : {};

    fences = fences.map(function (fence, index) {
      fence = fence || {};
      return {
        id: fence.id || uid("fence"),
        location: fence.location || "",
        customName: fence.customName || fence.name || "",
        role: fence.role || "Internal pool fence",
        index: index
      };
    });

    gates = gates.map(function (gate, index) {
      gate = gate || {};
      return {
        id: gate.id || uid("gate"),
        location: gate.location || "",
        customName: gate.customName || gate.name || "",
        index: index
      };
    });

    if (!fences.length) {
      fences.push({ id: uid("fence"), location: "", customName: "", role: "Internal pool fence", index: 0 });
    }
    if (!gates.length) {
      gates.push({ id: uid("gate"), location: "", customName: "", index: 0 });
    }

    var componentState = {};
    COMPONENTS.forEach(function (component) {
      componentState[component.key] = !!components[component.key];
    });

    return {
      version: STREAMLINE_VERSION,
      configuration: source.configuration || "",
      notes: source.notes || "",
      fences: fences,
      gates: gates,
      components: componentState
    };
  }

  function fenceDisplayName(fence, index) {
    var custom = String(fence && fence.customName || "").trim();
    var location = String(fence && fence.location || "").trim();
    if (custom) return custom;
    if (location && location !== "Other / Custom") return location + " Fence";
    return "Fence " + (index + 1);
  }

  function gateDisplayName(gate, index) {
    var custom = String(gate && gate.customName || "").trim();
    var location = String(gate && gate.location || "").trim();
    if (custom) return custom;
    if (location && location !== "Other / Custom") return location + " Gate";
    return "Gate " + (index + 1);
  }

  function getLayoutField() {
    return document.querySelector('[name="barrierLayoutConfig"]');
  }

  function readSavedLayout() {
    var field = getLayoutField();
    if (!field || !field.value) return null;
    try {
      return normaliseLayout(JSON.parse(field.value));
    } catch (error) {
      console.warn("BarrierCheck: could not parse barrier layout", error);
      return null;
    }
  }

  function inferLayoutFromSections() {
    var fences = Array.prototype.slice.call(document.querySelectorAll('.fence-card[data-section="fence"]')).map(function (card, index) {
      var location = card.querySelector('[name="fenceLocation"]');
      var existing = location ? String(location.value || "").trim() : "";
      return {
        id: uid("fence"),
        location: existing ? "Other / Custom" : "",
        customName: existing,
        role: "Internal pool fence",
        index: index
      };
    });

    var gates = Array.prototype.slice.call(document.querySelectorAll(".gate-card")).map(function (card, index) {
      var location = card.querySelector('[name="gateLocation"]');
      var existing = location ? String(location.value || "").trim() : "";
      return {
        id: uid("gate"),
        location: existing ? "Other / Custom" : "",
        customName: existing,
        index: index
      };
    });

    return normaliseLayout({ fences: fences, gates: gates });
  }

  function writeLayoutField() {
    var field = getLayoutField();
    if (!field || !layoutState) return;
    field.value = JSON.stringify(layoutState);
  }

  function scheduleSave() {
    writeLayoutField();
    clearTimeout(layoutSaveTimer);
    layoutSaveTimer = setTimeout(function () {
      if (window.inspectionStarted && typeof window.saveCurrentInspection === "function") {
        window.saveCurrentInspection(false);
      }
    }, 180);
  }

  function injectStyles() {
    if (document.getElementById("streamlineInspectionStyles")) return;
    var style = document.createElement("style");
    style.id = "streamlineInspectionStyles";
    style.textContent = [
      ".streamline-hidden{display:none!important}",
      ".streamline-overview-intro{margin:0 0 14px;color:#52616b;line-height:1.45}",
      ".streamline-layout-block{border:1px solid #d9e8ef;border-radius:14px;padding:14px;margin:14px 0;background:#fbfeff}",
      ".streamline-layout-block>h4{margin:0 0 4px;font-size:1rem}",
      ".streamline-layout-block>p{margin:0 0 12px;color:#667781;font-size:.9rem}",
      ".streamline-editor-row{border:1px solid #dce8ed;border-radius:12px;padding:12px;margin:10px 0;background:#fff}",
      ".streamline-editor-row-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}",
      ".streamline-editor-row-head strong{font-size:.96rem}",
      ".streamline-editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}",
      ".streamline-editor-grid .field.full{grid-column:1/-1}",
      ".streamline-remove{border:0;background:#fff1f1;color:#a52a2a;border-radius:9px;padding:7px 10px;font-weight:700;cursor:pointer}",
      ".streamline-add{width:100%;border:1px dashed #8eb8ca;background:#f5fbfe;color:#145f7a;border-radius:11px;padding:11px;font-weight:700;cursor:pointer}",
      ".streamline-components{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}",
      ".streamline-component{display:flex;align-items:flex-start;gap:9px;border:1px solid #e1eaee;border-radius:10px;padding:10px;background:#fff}",
      ".streamline-component input{margin-top:3px}",
      ".streamline-fence-details,.streamline-ncz-details{border:0;margin:0;padding:0}",
      ".streamline-card-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;list-style:none;padding:2px 0 10px}",
      ".streamline-card-summary::-webkit-details-marker{display:none}",
      ".streamline-card-summary .fence-card-head{flex:1;margin:0}",
      ".streamline-card-summary:after{content:'▾';font-size:1.15rem;color:#47758a;transition:transform .15s ease}",
      ".streamline-fence-details:not([open])>.streamline-card-summary:after,.streamline-ncz-details:not([open])>.streamline-card-summary:after{transform:rotate(-90deg)}",
      ".streamline-defined-note{display:block;color:#6d7f88;font-size:.78rem;margin-top:4px}",
      ".streamline-evidence-group{margin:12px 0 14px;padding:12px;border-radius:12px;background:#f6fbfd;border:1px solid #dcebf1}",
      ".streamline-evidence-group h4{margin:0 0 8px}",
      ".streamline-ncz-list{display:grid;gap:12px}",
      ".streamline-ncz-helper{margin:0 0 14px;color:#60727c}",
      ".streamline-additional-components{margin-top:14px}",
      ".streamline-additional-components>summary{cursor:pointer;font-weight:800;padding:14px;border:1px solid #d9e8ef;border-radius:12px;background:#f8fcfe;list-style:none}",
      ".streamline-additional-components>summary::-webkit-details-marker{display:none}",
      ".streamline-additional-components>summary:after{content:' +';float:right}",
      ".streamline-additional-components[open]>summary:after{content:' −'}",
      ".streamline-additional-body{padding-top:12px}",
      ".streamline-address-wrap{position:relative}",
      ".streamline-address-results{position:absolute;left:0;right:0;top:100%;z-index:50;background:#fff;border:1px solid #cddfe6;border-radius:10px;box-shadow:0 10px 26px rgba(26,60,74,.16);max-height:260px;overflow:auto;margin-top:4px}",
      ".streamline-address-option{width:100%;text-align:left;border:0;border-bottom:1px solid #edf2f4;background:#fff;padding:11px 12px;cursor:pointer;line-height:1.35}",
      ".streamline-address-option:hover,.streamline-address-option:focus{background:#f0f8fb;outline:none}",
      ".streamline-address-attribution{display:block;margin-top:5px;color:#7c8b92;font-size:.72rem}",
      "#addGateSectionBtn.streamline-gate-add{margin-top:12px;width:100%}",
      "@media(max-width:720px){.streamline-editor-grid,.streamline-components{grid-template-columns:1fr}.streamline-layout-block{padding:12px}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function setupAddressAutocomplete() {
    var oldField = document.querySelector('[name="propertyAddress"]');
    if (!oldField || oldField.dataset.streamlineAddress === "1") return;

    var input = document.createElement("input");
    input.type = "text";
    input.name = "propertyAddress";
    input.setAttribute("data-save", "");
    input.placeholder = "Start typing the property address";
    input.autocomplete = "off";
    input.dataset.streamlineAddress = "1";
    input.value = oldField.value || "";

    var wrap = document.createElement("div");
    wrap.className = "streamline-address-wrap";
    var results = document.createElement("div");
    results.className = "streamline-address-results";
    results.hidden = true;
    var attribution = document.createElement("small");
    attribution.className = "streamline-address-attribution";
    attribution.textContent = "Address suggestions © OpenStreetMap contributors";

    oldField.parentNode.insertBefore(wrap, oldField);
    wrap.appendChild(input);
    wrap.appendChild(results);
    wrap.appendChild(attribution);
    oldField.remove();

    function closeResults() {
      results.hidden = true;
      results.innerHTML = "";
    }

    function selectAddress(value) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closeResults();
    }

    input.addEventListener("input", function () {
      var query = input.value.trim();
      clearTimeout(addressTimer);
      if (addressAbortController) addressAbortController.abort();
      if (query.length < 3) {
        closeResults();
        return;
      }

      addressTimer = setTimeout(function () {
        addressAbortController = typeof AbortController !== "undefined" ? new AbortController() : null;
        var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=au&addressdetails=1&limit=6&accept-language=en-AU&q=" + encodeURIComponent(query);
        fetch(url, addressAbortController ? { signal: addressAbortController.signal } : {})
          .then(function (response) {
            if (!response.ok) throw new Error("Address search failed");
            return response.json();
          })
          .then(function (items) {
            results.innerHTML = "";
            (items || []).forEach(function (item) {
              var button = document.createElement("button");
              button.type = "button";
              button.className = "streamline-address-option";
              button.textContent = item.display_name || "";
              button.addEventListener("click", function () { selectAddress(item.display_name || ""); });
              results.appendChild(button);
            });
            results.hidden = !results.children.length;
          })
          .catch(function (error) {
            if (error && error.name === "AbortError") return;
            console.warn("BarrierCheck address suggestions unavailable", error);
            closeResults();
          });
      }, 500);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeResults();
    });
    document.addEventListener("click", function (event) {
      if (!wrap.contains(event.target)) closeResults();
    });
  }

  function removeInspectionNotes() {
    var notes = document.querySelector('[name="inspectionNotes"]');
    if (!notes) return;
    var field = notes.closest("label.field") || notes.parentElement;
    if (field) field.remove();
  }

  function buildBarrierOverview() {
    var barrier = document.querySelector("#barrier .barrier-check-list");
    if (!barrier) return;
    var groups = barrier.querySelectorAll(":scope > .barrier-check-group");
    var overview = groups[0];
    if (!overview || overview.dataset.streamlineOverview === "1") return;
    overview.dataset.streamlineOverview = "1";

    var title = overview.querySelector(".barrier-check-title h3");
    var subtitle = overview.querySelector(".barrier-check-title p");
    if (title) title.textContent = "Barrier Overview / Layout";
    if (subtitle) subtitle.textContent = "Map the fence runs, gates and other barrier components once before inspecting them.";

    var body = overview.querySelector(".barrier-check-body");
    if (!body) return;
    body.innerHTML = [
      '<p class="streamline-overview-intro">Define the physical pool enclosure here. BarrierCheck will use these names to create the matching Fence, NCZ and Gate inspection sections automatically.</p>',
      '<label class="field full"><span>Barrier configuration</span><select id="streamlineBarrierConfiguration">',
      '<option value="">Select configuration</option>',
      '<option>Fully freestanding pool fence</option>',
      '<option>Pool fence + boundary fence</option>',
      '<option>Pool fence + building</option>',
      '<option>Mixed / complex barrier</option>',
      '<option>Other</option>',
      '</select></label>',
      '<div class="streamline-layout-block"><h4>Fence runs</h4><p>Add each fence run that needs its own physical fence and NCZ assessment.</p><div id="streamlineFenceEditors"></div><button id="streamlineAddFence" class="streamline-add" type="button">+ Add fence run</button></div>',
      '<div class="streamline-layout-block"><h4>Gates</h4><p>Define each gate once. Matching Gate sections will be created automatically.</p><div id="streamlineGateEditors"></div><button id="streamlineAddGate" class="streamline-add" type="button">+ Add gate</button></div>',
      '<div class="streamline-layout-block"><h4>Additional barrier components</h4><p>Select only the extra features that apply to this property.</p><div id="streamlineComponentEditors" class="streamline-components"></div></div>',
      '<label class="field full"><span>Barrier layout notes (optional)</span><textarea id="streamlineBarrierNotes" placeholder="Only add notes that help explain an unusual or complex barrier layout."></textarea></label>',
      '<div class="streamline-evidence-group"><h4>Overall barrier photo</h4><div class="photo-widget" data-photo-area="barrier-location"><button class="camera-btn" type="button">+ Overall Barrier Photo</button><input type="file" accept="image/*" capture="environment" multiple hidden><div class="photo-grid"></div></div></div>',
      '<textarea class="streamline-hidden" data-save name="barrierLayoutConfig" aria-hidden="true" tabindex="-1"></textarea>'
    ].join("");

    bindOverviewEvents(body);
  }

  function bindOverviewEvents(body) {
    body.addEventListener("click", function (event) {
      var target = event.target;
      if (target.id === "streamlineAddFence") {
        layoutState.fences.push({ id: uid("fence"), location: "", customName: "", role: "Internal pool fence" });
        renderLayoutEditors();
        syncLayoutToInspection();
        scheduleSave();
        return;
      }
      if (target.id === "streamlineAddGate") {
        layoutState.gates.push({ id: uid("gate"), location: "", customName: "" });
        renderLayoutEditors();
        syncLayoutToInspection();
        scheduleSave();
        return;
      }
      var removeFence = target.closest("[data-remove-fence]");
      if (removeFence) {
        if (layoutState.fences.length <= 1) return;
        var fenceId = removeFence.getAttribute("data-remove-fence");
        layoutState.fences = layoutState.fences.filter(function (item) { return item.id !== fenceId; });
        renderLayoutEditors();
        syncLayoutToInspection(true);
        scheduleSave();
        return;
      }
      var removeGate = target.closest("[data-remove-gate]");
      if (removeGate) {
        if (layoutState.gates.length <= 1) return;
        var gateId = removeGate.getAttribute("data-remove-gate");
        layoutState.gates = layoutState.gates.filter(function (item) { return item.id !== gateId; });
        renderLayoutEditors();
        syncLayoutToInspection(true);
        scheduleSave();
      }
    });

    body.addEventListener("input", handleOverviewChange);
    body.addEventListener("change", handleOverviewChange);
  }

  function handleOverviewChange(event) {
    var target = event.target;
    if (!layoutState) return;

    if (target.id === "streamlineBarrierConfiguration") layoutState.configuration = target.value;
    if (target.id === "streamlineBarrierNotes") layoutState.notes = target.value;

    var fenceRow = target.closest("[data-fence-id]");
    if (fenceRow) {
      var fence = layoutState.fences.find(function (item) { return item.id === fenceRow.getAttribute("data-fence-id"); });
      if (fence) {
        var loc = fenceRow.querySelector('[data-fence-field="location"]');
        var custom = fenceRow.querySelector('[data-fence-field="customName"]');
        var role = fenceRow.querySelector('[data-fence-field="role"]');
        fence.location = loc ? loc.value : "";
        fence.customName = custom ? custom.value : "";
        fence.role = role ? role.value : "Internal pool fence";
        var fenceIndex = layoutState.fences.indexOf(fence);
        var fenceHeading = fenceRow.querySelector(".streamline-editor-row-head strong");
        if (fenceHeading) fenceHeading.textContent = fenceDisplayName(fence, fenceIndex);
      }
    }

    var gateRow = target.closest("[data-gate-id]");
    if (gateRow) {
      var gate = layoutState.gates.find(function (item) { return item.id === gateRow.getAttribute("data-gate-id"); });
      if (gate) {
        var gateLoc = gateRow.querySelector('[data-gate-field="location"]');
        var gateCustom = gateRow.querySelector('[data-gate-field="customName"]');
        gate.location = gateLoc ? gateLoc.value : "";
        gate.customName = gateCustom ? gateCustom.value : "";
        var gateIndex = layoutState.gates.indexOf(gate);
        var gateHeading = gateRow.querySelector(".streamline-editor-row-head strong");
        if (gateHeading) gateHeading.textContent = gateDisplayName(gate, gateIndex);
      }
    }

    if (target.matches("[data-component-key]")) {
      layoutState.components[target.getAttribute("data-component-key")] = !!target.checked;
    }

    syncLayoutToInspection();
    applyComponentVisibility();
    scheduleSave();
  }

  function renderLayoutEditors() {
    if (!layoutState) return;
    var fenceBox = document.getElementById("streamlineFenceEditors");
    var gateBox = document.getElementById("streamlineGateEditors");
    var componentBox = document.getElementById("streamlineComponentEditors");
    var configuration = document.getElementById("streamlineBarrierConfiguration");
    var notes = document.getElementById("streamlineBarrierNotes");

    if (configuration) configuration.value = layoutState.configuration || "";
    if (notes) notes.value = layoutState.notes || "";

    if (fenceBox) {
      fenceBox.innerHTML = layoutState.fences.map(function (fence, index) {
        return [
          '<div class="streamline-editor-row" data-fence-id="', esc(fence.id), '">',
          '<div class="streamline-editor-row-head"><strong>', esc(fenceDisplayName(fence, index)), '</strong>',
          layoutState.fences.length > 1 ? '<button class="streamline-remove" type="button" data-remove-fence="' + esc(fence.id) + '">Remove</button>' : "",
          '</div><div class="streamline-editor-grid">',
          '<label class="field"><span>Location</span><select data-fence-field="location">', optionMarkup(FENCE_LOCATIONS, fence.location, "Select location"), '</select></label>',
          '<label class="field"><span>Barrier role</span><select data-fence-field="role">', optionMarkup(FENCE_ROLES, fence.role), '</select></label>',
          '<label class="field full"><span>Custom name (optional)</span><input data-fence-field="customName" type="text" value="', esc(fence.customName), '" placeholder="e.g. Rear Boundary Fence — Neighbour Side"></label>',
          '</div></div>'
        ].join("");
      }).join("");
    }

    if (gateBox) {
      gateBox.innerHTML = layoutState.gates.map(function (gate, index) {
        return [
          '<div class="streamline-editor-row" data-gate-id="', esc(gate.id), '">',
          '<div class="streamline-editor-row-head"><strong>', esc(gateDisplayName(gate, index)), '</strong>',
          layoutState.gates.length > 1 ? '<button class="streamline-remove" type="button" data-remove-gate="' + esc(gate.id) + '">Remove</button>' : "",
          '</div><div class="streamline-editor-grid">',
          '<label class="field"><span>Location</span><select data-gate-field="location">', optionMarkup(GATE_LOCATIONS, gate.location, "Select location"), '</select></label>',
          '<label class="field"><span>Custom name (optional)</span><input data-gate-field="customName" type="text" value="', esc(gate.customName), '" placeholder="e.g. Main Entry Gate"></label>',
          '</div></div>'
        ].join("");
      }).join("");
    }

    if (componentBox) {
      componentBox.innerHTML = COMPONENTS.map(function (component) {
        return '<label class="streamline-component"><input type="checkbox" data-component-key="' + esc(component.key) + '"' + (layoutState.components[component.key] ? " checked" : "") + '><span>' + esc(component.label) + "</span></label>";
      }).join("");
    }

    writeLayoutField();
  }

  function fenceTemplate(number) {
    return '' +
      '<details class="streamline-fence-details" open>' +
        '<summary class="streamline-card-summary"><div class="fence-card-head"><h3>Fence Section ' + number + '</h3><button class="remove-section-btn" type="button">Remove</button></div></summary>' +
        '<div class="details-group numbered-group">' +
          '<div class="group-title-row"><span class="group-number">A</span><h3>Identity / Location</h3></div>' +
          '<div class="form-grid">' +
            '<label class="field full"><span>Fence run</span><input data-save name="fenceLocation" type="text" readonly><small class="streamline-defined-note">Defined in Barrier Overview / Layout</small></label>' +
            '<label class="field"><span>Fence material / type</span><select data-save name="fenceType"><option value="">Select type</option><option>Aluminium</option><option>Glass</option><option>Timber</option><option>Chainwire / mesh</option><option>Masonry</option><option>Other</option></select></label>' +
            '<label class="field"><span>Fence material / finish safe</span><select data-save name="fenceMaterialFinishSafe"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
          '</div>' +
        '</div>' +
        '<div class="streamline-evidence-group"><h4>Evidence Photos</h4><div class="photo-widget" data-photo-area="fence-' + number + '"><button class="camera-btn" type="button">+ Evidence Photo</button><input type="file" accept="image/*" capture="environment" multiple hidden><div class="photo-grid"></div></div></div>' +
        '<div class="details-group numbered-group">' +
          '<div class="group-title-row"><span class="group-number">B</span><h3>Measurements / Physical Compliance</h3></div>' +
          '<div class="form-grid">' +
            '<label class="field"><span>Effective height (mm)</span><input data-save name="fenceHeight" type="number" placeholder="1200"></label>' +
            '<label class="field"><span>Ground clearance (mm)</span><input data-save name="fenceGroundClearance" type="number" placeholder="100"></label>' +
            '<label class="field"><span>Openings / gaps compliant</span><select data-save name="fenceGaps"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Mesh / perforated aperture size (mm)</span><input data-save name="fenceApertureSize" type="number" placeholder="If applicable"></label>' +
          '</div>' +
        '</div>' +
        '<div class="details-group numbered-group">' +
          '<div class="group-title-row"><span class="group-number">C</span><h3>Strength / Condition</h3></div>' +
          '<div class="form-grid">' +
            '<label class="field"><span>Projections / indentations compliant</span><select data-save name="fenceProjectionsCompliant"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Strength / rigidity acceptable</span><select data-save name="fenceStrengthRigid"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Posts / footings / fixings secure</span><select data-save name="fenceFixingsSecure"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field full"><span>Additional Inspector Note (optional)</span><textarea data-save name="fenceComments" placeholder="Only add context that the structured checks cannot capture."></textarea></label>' +
          '</div>' +
        '</div>' +
      '</details>';
  }

  function nczTemplate(number) {
    return '' +
      '<details class="streamline-ncz-details" open>' +
        '<summary class="streamline-card-summary"><div class="fence-card-head"><h3>NCZ Section ' + number + '</h3></div></summary>' +
        '<div class="details-group numbered-group">' +
          '<div class="group-title-row"><span class="group-number">A</span><h3>Fence run / NCZ location</h3></div>' +
          '<div class="form-grid">' +
            '<label class="field full"><span>Fence run</span><input data-save name="nczLocation" type="text" readonly><small class="streamline-defined-note">Automatically linked to the matching fence from Barrier Overview.</small></label>' +
            '<input class="streamline-hidden" data-save name="nczObjectType" value="Fence run NCZ" aria-hidden="true">' +
            '<input class="streamline-hidden" data-save name="nczBarrierRole" value="" aria-hidden="true">' +
            '<label class="field"><span>NCZ side of barrier</span><select data-save name="nczSideOfBarrier"><option value=""></option><option>Inside pool area</option><option>Outside pool area</option><option>Both / requires assessment</option></select></label>' +
            '<label class="field"><span>Minimum clear distance observed (mm)</span><input data-save name="nczDistance" type="number" placeholder="900"></label>' +
          '</div>' +
        '</div>' +
        '<div class="streamline-evidence-group"><h4>Evidence Photos</h4><div class="photo-widget" data-photo-area="climbability-' + number + '"><button class="camera-btn" type="button">+ Evidence Photo</button><input type="file" accept="image/*" capture="environment" multiple hidden><div class="photo-grid"></div></div></div>' +
        '<div class="details-group numbered-group">' +
          '<div class="group-title-row"><span class="group-number">B</span><h3>NCZ compliance</h3></div>' +
          '<div class="form-grid">' +
            '<label class="field"><span>900mm NCZ provided</span><select data-save name="ncz900Provided"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>NCZ on correct side of barrier</span><select data-save name="nczCorrectSide"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>No handholds or footholds in NCZ</span><select data-save name="nczNoHandholdsFootholds"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Projections / indentations compliant</span><select data-save name="nczProjectionsIndentationsCompliant"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Horizontal surface over 10mm?</span><select data-save name="nczHorizontalSurface"><option value=""></option><option>Yes</option><option>No</option><option>N/A</option></select></label>' +
          '</div>' +
        '</div>' +
        '<div class="details-group numbered-group">' +
          '<div class="group-title-row"><span class="group-number">C</span><h3>Climbable features / clear area</h3></div>' +
          '<div class="form-grid">' +
            '<label class="field"><span>Vegetation non-climbable</span><select data-save name="nczVegetationNonClimbable"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Furniture / equipment / objects clear</span><select data-save name="nczObjectsRemoved"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Additional clear area required</span><select data-save name="additionalClearAreaRequired"><option value=""></option><option>Yes</option><option>No</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Additional clear area maintained</span><select data-save name="additionalClearAreaMaintained"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Effective barrier height maintained</span><select data-save name="effectiveBarrierHeightMaintained"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Steps / ledges / raised areas clear</span><select data-save name="stepsLedgesRaisedAreasClear"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Taps / power outlets assessed</span><select data-save name="tapsPowerOutletsAssessed"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Raised garden beds assessed</span><select data-save name="raisedGardenBedsAssessed"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field"><span>Overall NCZ compliant</span><select data-save name="nczCompliant"><option value=""></option><option>Pass</option><option>Fail</option><option>N/A</option></select></label>' +
            '<label class="field full"><span>Additional Inspector Note (optional)</span><textarea data-save name="nczComments" placeholder="Only add context that the structured checks cannot capture."></textarea></label>' +
          '</div>' +
        '</div>' +
      '</details>';
  }

  function rebuildNczPage() {
    var card = document.querySelector("#climbability .section-card");
    if (!card || card.dataset.streamlineNcz === "1") return;
    card.dataset.streamlineNcz = "1";
    var heading = card.querySelector(":scope > .section-heading");
    Array.prototype.slice.call(card.children).forEach(function (child) {
      if (child !== heading) child.remove();
    });
    var helper = document.createElement("p");
    helper.className = "streamline-ncz-helper";
    helper.textContent = "Each NCZ section is automatically linked to a fence run defined in Barrier Overview / Layout.";
    var list = document.createElement("div");
    list.id = "climbabilitySections";
    list.className = "fence-sections streamline-ncz-list";
    card.appendChild(helper);
    card.appendChild(list);
  }

  function addStreamlinedClimbabilitySection(data) {
    var list = document.querySelector("#climbabilitySections");
    if (!list) return;
    window.climbabilityCounter = Number(window.climbabilityCounter || 0) + 1;
    var number = window.climbabilityCounter;
    var card = document.createElement("article");
    card.className = "fence-card climbability-card";
    card.setAttribute("data-section", "climbabilityItem");
    card.innerHTML = nczTemplate(number);

    if (typeof window.prepareBlankDropdowns === "function") window.prepareBlankDropdowns(card);
    if (typeof window.bindSaveEvents === "function") window.bindSaveEvents(card);
    var widget = card.querySelector(".photo-widget");
    if (widget && typeof window.bindPhotoWidget === "function") window.bindPhotoWidget(widget);
    list.appendChild(card);

    if (data) {
      if (typeof window.restoreCardFields === "function") window.restoreCardFields(card, data.fields || {});
      if (typeof window.restorePhotosToGrid === "function") window.restorePhotosToGrid(card.querySelector(".photo-grid"), data.photos || []);
    }

    if (typeof window.updateRequiredFieldMarkers === "function") window.updateRequiredFieldMarkers();
    if (typeof window.refreshSummary === "function") window.refreshSummary();
  }

  function groupAdditionalBarrierComponents() {
    var list = document.querySelector("#barrier .barrier-check-list");
    if (!list || list.querySelector(".streamline-additional-components")) return;
    var groups = Array.prototype.slice.call(list.querySelectorAll(":scope > .barrier-check-group"));
    if (groups.length <= 2) return;

    var wrapper = document.createElement("details");
    wrapper.className = "streamline-additional-components";
    wrapper.innerHTML = '<summary>Additional Barrier Components</summary><div class="streamline-additional-body"><p class="helper-text">Add or inspect only the extra features that form part of this pool barrier.</p></div>';
    var body = wrapper.querySelector(".streamline-additional-body");
    groups.slice(2).forEach(function (group) { body.appendChild(group); });
    list.appendChild(wrapper);
  }

  function applyComponentVisibility() {
    if (!layoutState) return;
    var wrapper = document.querySelector(".streamline-additional-components");
    if (!wrapper) return;
    var groups = Array.prototype.slice.call(wrapper.querySelectorAll(".barrier-check-group"));
    groups.forEach(function (group) {
      var heading = group.querySelector("h3");
      var text = heading ? heading.textContent : "";
      var definition = COMPONENTS.find(function (component) { return text.indexOf(component.match) !== -1; });
      if (!definition) return;
      group.hidden = !layoutState.components[definition.key];
    });
  }

  function moveGateAddButton() {
    var gateSection = document.querySelector("#gate .section-card");
    var gateChecks = document.querySelector("#gate .gate-section-group");
    var addButton = document.getElementById("addGateSectionBtn");
    if (!gateSection || !gateChecks || !addButton) return;
    addButton.classList.add("streamline-gate-add");
    gateChecks.insertAdjacentElement("afterend", addButton);
  }

  function removeExcessCards(selector, targetCount, destructive) {
    var cards = Array.prototype.slice.call(document.querySelectorAll(selector));
    while (cards.length > targetCount) {
      var card = cards[cards.length - 1];
      var remove = card.querySelector(".remove-section-btn");
      if (destructive && remove && !remove.disabled) remove.click();
      else card.remove();
      cards.pop();
    }
  }

  function syncFenceCards(destructive) {
    if (!layoutState || typeof window.addFenceSection !== "function") return;
    var cards = Array.prototype.slice.call(document.querySelectorAll('.fence-card[data-section="fence"]'));
    while (cards.length < layoutState.fences.length) {
      window.addFenceSection();
      cards = Array.prototype.slice.call(document.querySelectorAll('.fence-card[data-section="fence"]'));
    }
    removeExcessCards('.fence-card[data-section="fence"]', layoutState.fences.length, destructive);
    cards = Array.prototype.slice.call(document.querySelectorAll('.fence-card[data-section="fence"]'));

    cards.forEach(function (card, index) {
      var fence = layoutState.fences[index];
      if (!fence) return;
      var display = fenceDisplayName(fence, index);
      var title = card.querySelector(".streamline-card-summary h3") || card.querySelector("h3");
      if (title) title.textContent = display;
      var location = card.querySelector('[name="fenceLocation"]');
      if (location && location.value !== display) {
        location.value = display;
        location.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  function syncNczCards() {
    if (!layoutState || typeof window.addClimbabilitySection !== "function") return;
    var cards = Array.prototype.slice.call(document.querySelectorAll(".climbability-card"));
    while (cards.length < layoutState.fences.length) {
      window.addClimbabilitySection();
      cards = Array.prototype.slice.call(document.querySelectorAll(".climbability-card"));
    }
    removeExcessCards(".climbability-card", layoutState.fences.length, false);
    cards = Array.prototype.slice.call(document.querySelectorAll(".climbability-card"));

    cards.forEach(function (card, index) {
      var fence = layoutState.fences[index];
      if (!fence) return;
      var display = fenceDisplayName(fence, index);
      var title = card.querySelector(".streamline-card-summary h3") || card.querySelector("h3");
      if (title) title.textContent = "NCZ — " + display;
      var location = card.querySelector('[name="nczLocation"]');
      var role = card.querySelector('[name="nczBarrierRole"]');
      if (location && location.value !== display) location.value = display;
      if (role) role.value = fence.role || "";
      if (fence.role === "Boundary fence") {
        var side = card.querySelector('[name="nczSideOfBarrier"]');
        if (side && !side.value) side.value = "Inside pool area";
      }
    });
  }

  function syncGateCards(destructive) {
    if (!layoutState || typeof window.addGateSection !== "function") return;
    var cards = Array.prototype.slice.call(document.querySelectorAll(".gate-card"));
    syncingGateCards = true;
    while (cards.length < layoutState.gates.length) {
      window.addGateSection();
      cards = Array.prototype.slice.call(document.querySelectorAll(".gate-card"));
    }
    syncingGateCards = false;
    removeExcessCards(".gate-card", layoutState.gates.length, destructive);
    cards = Array.prototype.slice.call(document.querySelectorAll(".gate-card"));

    cards.forEach(function (card, index) {
      var gate = layoutState.gates[index];
      if (!gate) return;
      var display = gateDisplayName(gate, index);
      var title = card.querySelector(".fence-card-head h3") || card.querySelector("h3");
      if (title) title.textContent = display;
      var location = card.querySelector('[name="gateLocation"]');
      if (location) {
        location.value = display;
        location.readOnly = true;
        if (!location.parentElement.querySelector(".streamline-defined-note")) {
          var note = document.createElement("small");
          note.className = "streamline-defined-note";
          note.textContent = "Defined in Barrier Overview / Layout";
          location.parentElement.appendChild(note);
        }
      }
    });
  }

  function syncLayoutToInspection(destructive) {
    if (!layoutState) return;
    syncFenceCards(!!destructive);
    syncNczCards();
    syncGateCards(!!destructive);
    writeLayoutField();
  }

  function initialiseLayoutFromForm() {
    layoutState = readSavedLayout() || inferLayoutFromSections();
    renderLayoutEditors();
    syncLayoutToInspection();
    applyComponentVisibility();
  }

  function patchCompletionRules() {
    window.barrierComplete = function (data) {
      var fields = data && data.fields || {};
      var config = null;
      try { config = fields.barrierLayoutConfig ? normaliseLayout(JSON.parse(fields.barrierLayoutConfig)) : null; } catch (error) { config = null; }
      if (!config || !config.configuration || !config.fences.length) return false;
      var sections = data && data.fenceSections || [];
      if (sections.length !== config.fences.length) return false;
      return sections.every(function (section) {
        var f = section && section.fields || {};
        return ["fenceLocation", "fenceType", "fenceHeight", "fenceGroundClearance", "fenceGaps", "fenceStrengthRigid", "fenceFixingsSecure"].every(function (key) {
          return String(f[key] === undefined || f[key] === null ? "" : f[key]).trim() !== "";
        });
      });
    };

    window.climbabilityComplete = function (data) {
      var fields = data && data.fields || {};
      var config = null;
      try { config = fields.barrierLayoutConfig ? normaliseLayout(JSON.parse(fields.barrierLayoutConfig)) : null; } catch (error) { config = null; }
      if (!config || !config.fences.length) return false;
      var sections = data && data.climbabilitySections || [];
      if (sections.length !== config.fences.length) return false;
      var required = [
        "nczLocation",
        "nczSideOfBarrier",
        "ncz900Provided",
        "nczCorrectSide",
        "nczNoHandholdsFootholds",
        "nczProjectionsIndentationsCompliant",
        "nczVegetationNonClimbable",
        "nczObjectsRemoved",
        "stepsLedgesRaisedAreasClear",
        "tapsPowerOutletsAssessed",
        "raisedGardenBedsAssessed",
        "nczCompliant"
      ];
      return sections.every(function (section) {
        var f = section && section.fields || {};
        return required.every(function (key) {
          return String(f[key] === undefined || f[key] === null ? "" : f[key]).trim() !== "";
        });
      });
    };
  }

  function patchLifecycle() {
    var originalStartNewInspection = window.startNewInspection;
    if (typeof originalStartNewInspection === "function") {
      window.startNewInspection = function () {
        layoutState = null;
        var result = originalStartNewInspection.apply(this, arguments);
        initialiseLayoutFromForm();
        return result;
      };
    }

    var originalLoadInspectionIntoForm = window.loadInspectionIntoForm;
    if (typeof originalLoadInspectionIntoForm === "function") {
      window.loadInspectionIntoForm = function () {
        layoutState = null;
        var result = originalLoadInspectionIntoForm.apply(this, arguments);
        if (result !== false) initialiseLayoutFromForm();
        return result;
      };
    }

    var originalAddGateSection = window.addGateSection;
    if (typeof originalAddGateSection === "function") {
      window.addGateSection = function () {
        var data = arguments[0];
        var result = originalAddGateSection.apply(this, arguments);
        if (layoutState && !syncingGateCards && !data) {
          layoutState.gates.push({ id: uid("gate"), location: "", customName: "" });
          renderLayoutEditors();
          syncGateCards(false);
          scheduleSave();
        } else if (layoutState && !syncingGateCards) {
          syncGateCards(false);
        }
        return result;
      };
    }
  }

  function prepareUi() {
    injectStyles();
    setupAddressAutocomplete();
    removeInspectionNotes();
    buildBarrierOverview();
    rebuildNczPage();
    groupAdditionalBarrierComponents();
    moveGateAddButton();
    var addFenceButton = document.getElementById("addFenceSectionBtn");
    if (addFenceButton) addFenceButton.classList.add("streamline-hidden");
  }

  // Replace the dynamic templates before core init binds the UI.
  window.fenceTemplate = fenceTemplate;
  window.addClimbabilitySection = addStreamlinedClimbabilitySection;
  window.renumberClimbabilitySections = function () { syncNczCards(); };
  patchCompletionRules();
  patchLifecycle();
  prepareUi();

  // Default layout is rendered once core init has created/restored any sections.
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      if (!layoutState && document.querySelector('.fence-card[data-section="fence"]')) initialiseLayoutFromForm();
    }, 0);
  });
})();
