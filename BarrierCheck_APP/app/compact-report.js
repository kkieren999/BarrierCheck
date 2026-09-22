// BarrierCheck compact client report generator.
// Replaces printing the inspection UI with a concise A4 report + coded photo appendix.
(function () {
  "use strict";

  var REPORT_VERSION = "20260810.1";
  var originalCloseDownloadMode = window.closeDownloadMode;

  function esc(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clean(value) {
    return String(value === undefined || value === null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function valueOf(name) {
    var el = document.querySelector('[name="' + name + '"]');
    if (!el) return "";
    if (el.type === "checkbox") return el.checked ? "Yes" : "No";
    return clean(el.value);
  }

  function displayDate(value) {
    if (!value) return "—";
    if (typeof window.formatDate === "function" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return window.formatDate(value);
    }
    return value;
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    if (el.classList && el.classList.contains("streamline-hidden")) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    return !style || (style.display !== "none" && style.visibility !== "hidden");
  }

  function controlValue(control) {
    if (!control) return "";
    if (control.type === "checkbox") return control.checked ? "Yes" : "No";
    if (control.type === "radio") return control.checked ? clean(control.value) : "";
    return clean(control.value);
  }

  function labelText(label) {
    if (!label) return "";
    var span = label.querySelector(":scope > span") || label.querySelector("span");
    return clean(span ? span.textContent : "");
  }

  function extractEntries(root) {
    if (!root) return [];
    var entries = [];
    var seen = {};
    Array.prototype.slice.call(root.querySelectorAll("label.field, label.check-field, label.toggle-field")).forEach(function (label) {
      if (!isVisible(label)) return;
      var control = label.querySelector("input, select, textarea");
      if (!control || control.type === "file" || control.type === "hidden") return;
      if (control.name === "barrierLayoutConfig") return;
      var labelName = labelText(label);
      var value = controlValue(control);
      if (!labelName || !value) return;
      var key = labelName + "\u0000" + value;
      if (seen[key]) return;
      seen[key] = true;
      entries.push({ label: labelName, value: value });
    });
    return entries;
  }

  function contextualTitle(el, fallback) {
    if (!el) return fallback || "Inspection item";
    var selectors = [
      ".streamline-card-summary h3",
      ".fence-card-head h3",
      ".barrier-check-title h3",
      ".details-check-title h3",
      ".climbability-section-title h3",
      ".gate-section-title h3",
      ".safety-section-title h3",
      ".safety-check-title h3",
      ".section-heading h2",
      "h3"
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      var node = el.querySelector(selectors[i]);
      if (node && clean(node.textContent)) return clean(node.textContent);
    }
    return fallback || "Inspection item";
  }

  function photoPrefix(area) {
    var match;
    if (area === "barrier-location") return "IMG-OV";
    match = /^fence-(\d+)$/i.exec(area); if (match) return "IMG-F" + match[1];
    match = /^climbability-(\d+)$/i.exec(area); if (match) return "IMG-NCZ-F" + match[1];
    match = /^gate-(\d+)$/i.exec(area); if (match) return "IMG-G" + match[1];
    match = /^balcony-(\d+)$/i.exec(area); if (match) return "IMG-BAL" + match[1];
    match = /^retaining-wall-(\d+)$/i.exec(area); if (match) return "IMG-RW" + match[1];
    match = /^boundary-(\d+)$/i.exec(area); if (match) return "IMG-BF" + match[1];
    match = /^special-pool-feature-(\d+)$/i.exec(area); if (match) return "IMG-SP" + match[1];
    match = /^water-barrier-(\d+)$/i.exec(area); if (match) return "IMG-WB" + match[1];
    match = /^barrier-window-(\d+)$/i.exec(area); if (match) return "IMG-WIN" + match[1];
    match = /^barrier-door-(\d+)$/i.exec(area); if (match) return "IMG-DOOR" + match[1];
    match = /^temporary-fencing-(\d+)$/i.exec(area); if (match) return "IMG-TEMP" + match[1];
    var slug = clean(area).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 12);
    return "IMG-" + (slug || "GEN");
  }

  function buildPhotoRegistry() {
    var photos = [];
    var byWidget = new Map();
    var prefixCounts = {};

    Array.prototype.slice.call(document.querySelectorAll(".photo-widget")).forEach(function (widget) {
      if (!isVisible(widget)) return;
      var area = clean(widget.getAttribute("data-photo-area"));
      if (!area) return;
      var boxes = Array.prototype.slice.call(widget.querySelectorAll(".photo-box"));
      if (!boxes.length) return;
      var prefix = photoPrefix(area);
      var codes = [];
      var context = widget.closest(".fence-card, .barrier-check-group, .details-check-group, .climbability-section-group, .gate-section-group, .safety-section-group, .safety-check-group, .section-card") || widget.parentElement;
      var title = contextualTitle(context, area);

      boxes.forEach(function (box) {
        var img = box.querySelector("img");
        if (!img || !img.src) return;
        prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
        var code = prefix + "-" + String(prefixCounts[prefix]).padStart(2, "0");
        var timestamp = box.querySelector(".timestamp");
        var caption = title;
        if (timestamp && clean(timestamp.textContent)) caption += " — " + clean(timestamp.textContent);
        photos.push({ code: code, area: area, src: img.src, caption: caption });
        codes.push(code);
      });
      if (codes.length) byWidget.set(widget, codes);
    });

    return { photos: photos, byWidget: byWidget };
  }

  function evidenceCodes(root, registry) {
    if (!root || !registry) return [];
    var codes = [];
    Array.prototype.slice.call(root.querySelectorAll(".photo-widget")).forEach(function (widget) {
      var list = registry.byWidget.get(widget) || [];
      list.forEach(function (code) { if (codes.indexOf(code) === -1) codes.push(code); });
    });
    return codes;
  }

  function evidenceText(codes) {
    if (!codes || !codes.length) return "—";
    if (codes.length === 1) return "Refer to " + codes[0] + " in Appendix A";
    return "Refer to " + codes.join(", ") + " in Appendix A";
  }

  function statusClass(value) {
    var v = clean(value).toLowerCase();
    if (v === "fail" || v.indexOf("non-compliant") !== -1 || v.indexOf("not compliant") !== -1) return "fail";
    if (v === "pass" || v === "compliant") return "pass";
    if (v === "n/a" || v === "not applicable") return "na";
    return "value";
  }

  function renderEntryTable(entries, codes) {
    if (!entries.length && (!codes || !codes.length)) return "";
    var pass = [];
    var na = [];
    var rows = [];

    entries.forEach(function (entry) {
      var cls = statusClass(entry.value);
      if (cls === "pass") pass.push(entry.label);
      else if (cls === "na") na.push(entry.label);
      else rows.push('<tr class="cr-' + cls + '"><th>' + esc(entry.label) + '</th><td>' + esc(entry.value) + '</td></tr>');
    });

    if (pass.length) rows.push('<tr class="cr-pass"><th>Compliant checks</th><td>' + esc(pass.join("; ")) + '</td></tr>');
    if (na.length) rows.push('<tr class="cr-na"><th>Not applicable</th><td>' + esc(na.join("; ")) + '</td></tr>');
    if (codes && codes.length) rows.push('<tr><th>Evidence</th><td>' + esc(evidenceText(codes)) + '</td></tr>');

    return '<table class="cr-table"><tbody>' + rows.join("") + '</tbody></table>';
  }

  function renderSubsection(title, root, registry) {
    var entries = extractEntries(root);
    var codes = evidenceCodes(root, registry);
    if (!entries.length && !codes.length) return "";
    return '<section class="cr-subsection"><h3>' + esc(title) + '</h3>' + renderEntryTable(entries, codes) + '</section>';
  }

  function parseLayout() {
    var raw = valueOf("barrierLayoutConfig");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (error) { return null; }
  }

  function renderBarrierLayout(layout) {
    if (!layout) return "";
    var rows = [];
    if (layout.configuration) rows.push(["Barrier configuration", layout.configuration]);
    (layout.fences || []).forEach(function (fence, index) {
      var name = clean(fence.customName) || (clean(fence.location) && fence.location !== "Other / Custom" ? fence.location + " Fence" : "Fence " + (index + 1));
      rows.push(["Fence " + (index + 1), name + (fence.role ? " — " + fence.role : "")]);
    });
    (layout.gates || []).forEach(function (gate, index) {
      var name = clean(gate.customName) || (clean(gate.location) && gate.location !== "Other / Custom" ? gate.location + " Gate" : "Gate " + (index + 1));
      rows.push(["Gate " + (index + 1), name]);
    });
    if (layout.notes) rows.push(["Layout notes", layout.notes]);
    if (!rows.length) return "";
    return '<section class="cr-subsection"><h3>Barrier Overview / Layout</h3><table class="cr-table"><tbody>' + rows.map(function (row) {
      return '<tr><th>' + esc(row[0]) + '</th><td>' + esc(row[1]) + '</td></tr>';
    }).join("") + '</tbody></table></section>';
  }

  function requirementGuidance(finding) {
    var haystack = [finding.id, finding.field, finding.item, finding.requirement].map(clean).join(" ").toLowerCase();
    var guidance = { quote: "", document: clean(finding.source), note: "" };

    if (/swing|open.*pool|opens away|direction of opening/.test(haystack)) {
      guidance.quote = "“must not open towards the pool area”";
      guidance.document = "Queensland Development Code MP 3.4, Schedule 1 modification 15 (AS 1926.1 cl 2.5.1)";
      guidance.note = "In plain English: the gate must open away from the pool, not into it.";
    } else if (/self.?clos|self.?latch|closing.*latching|latch prevents|close.*any position/.test(haystack)) {
      guidance.quote = "“automatically close and latch”";
      guidance.document = "Queensland Development Code MP 3.4, Performance Requirement P1(d); AS 1926.1—2007 cls 2.5.3–2.5.4";
      guidance.note = "In plain English: a child-resistant gate must close and latch by itself after it is released.";
    } else if (/ground clearance|gap under gate|gap under|opening between the bottom/.test(haystack)) {
      guidance.quote = "“shall not exceed 100 mm”";
      guidance.document = "AS 1926.1—2007 cl 2.4 (ground clearance) / cl 2.5.2 (gate gap), subject to QDC MP 3.4";
      guidance.note = "In plain English: the opening below the barrier must be small enough that a young child cannot pass underneath.";
    } else if (/effective height|fence height|barrier height/.test(haystack)) {
      guidance.quote = "“shall be not less than 1200 mm”";
      guidance.document = "AS 1926.1—2007 cl 2.1, with QDC MP 3.4 Schedule 1 modifications applying";
      guidance.note = "In plain English: the barrier needs sufficient effective height, measured on the applicable NCZ side.";
    } else if (/handhold|foothold|900.*ncz|ncz.*900|non-climbable zone/.test(haystack)) {
      guidance.quote = "“not less than 900 mm”";
      guidance.document = "AS 1926.1—2007 cl 2.1 and QDC MP 3.4 Schedule 1 modifications 6–11";
      guidance.note = "In plain English: the required non-climbable zone must prevent nearby features from acting as climbing aids.";
    } else if (/projection|indentation|horizontal surface/.test(haystack)) {
      guidance.quote = "“depth greater than 10 mm”";
      guidance.document = "AS 1926.1—2007 cl 2.3.3, subject to QDC MP 3.4";
      guidance.note = "In plain English: ledges or projections in the NCZ must not provide usable handholds or footholds.";
    } else if (/vertical member|openings.*gaps|clear space.*member/.test(haystack)) {
      guidance.quote = "“shall not exceed 100 mm at any point”";
      guidance.document = "AS 1926.1—2007 cl 2.3.7, subject to QDC MP 3.4";
      guidance.note = "In plain English: openings in the fence must not be wide enough for a young child to pass through.";
    } else if (/material.*finish|sharp edge|entrapping/.test(haystack)) {
      guidance.quote = "“free of sharp edges, sharp projections, entrapping spaces and similar hazards”";
      guidance.document = "AS 1926.1—2007 cl 2.2, subject to QDC MP 3.4";
      guidance.note = "In plain English: the barrier must not introduce sharp or trapping hazards.";
    } else if (/post|footing|fixing|strength.*rigid|rigidity/.test(haystack)) {
      guidance.quote = "“Each post and footing shall withstand a horizontal 330 N force”";
      guidance.document = "AS 1926.1—2007 cl 3.2; related component requirements in cl 3.3";
      guidance.note = "In plain English: the fence and its supports must be strong, secure and not loosen under foreseeable loading.";
    } else if (/above.?ground|ladder/.test(haystack)) {
      guidance.quote = "“A barrier shall be placed around ladders at the access point”";
      guidance.document = "AS 1926.1—2007 cl 2.10, with QDC MP 3.4 Schedule 1 modification 21";
      guidance.note = "In plain English: ladders and access points must not provide an uncontrolled way into the pool.";
    }

    return guidance;
  }

  function findingEvidence(finding, registry) {
    var item = clean(finding.item);
    var match;
    var areaCandidates = [];
    match = /fence(?: section)?\s*(\d+)/i.exec(item); if (match) areaCandidates.push("fence-" + match[1]);
    match = /(?:ncz|climbability)(?: section| check| \/ climbable object)?\s*(\d+)/i.exec(item); if (match) areaCandidates.push("climbability-" + match[1]);
    match = /gate\s*(\d+)/i.exec(item); if (match) areaCandidates.push("gate-" + match[1]);

    var codes = [];
    registry.photos.forEach(function (photo) {
      if (areaCandidates.indexOf(photo.area) !== -1 && codes.indexOf(photo.code) === -1) codes.push(photo.code);
    });
    return codes;
  }

  function renderFindings(findings, registry) {
    if (!findings.length) {
      return '<section class="cr-section"><h2>Findings & Required Actions</h2><div class="cr-empty">No failed rule checks were generated from the recorded inspection data.</div></section>';
    }

    var html = '<section class="cr-section"><h2>Findings & Required Actions</h2><p class="cr-intro">This section explains each identified issue in plain language, states the requirement used for assessment and points to supporting photographic evidence where available.</p>';
    findings.forEach(function (finding, index) {
      var guidance = requirementGuidance(finding);
      var evidence = findingEvidence(finding, registry);
      html += '<article class="cr-finding">' +
        '<div class="cr-finding-head"><span>F' + String(index + 1).padStart(2, "0") + '</span><strong>' + esc(finding.item || finding.field || "Inspection finding") + '</strong></div>' +
        '<div class="cr-finding-grid">' +
          '<div><b>What was found</b><p>' + esc(finding.issue || ((finding.field || "Item") + " was recorded as " + (finding.value || "Fail") + ".")) + '</p></div>' +
          '<div><b>Why it matters</b><p>' + esc(finding.risk || "This condition may reduce the effectiveness of the pool safety barrier.") + '</p></div>' +
          '<div><b>Required action</b><p>' + esc(finding.recommendation || "Rectify the item so it satisfies the applicable pool safety requirement.") + '</p></div>' +
          '<div><b>Requirement</b><p>' + esc(finding.requirement || "See the cited source document and clause.") + '</p>' +
            (guidance.quote ? '<p class="cr-quote">Key wording: ' + esc(guidance.quote) + '</p>' : '') +
            (guidance.note ? '<p class="cr-plain">' + esc(guidance.note) + '</p>' : '') +
          '</div>' +
          '<div class="cr-wide"><b>Source / clause</b><p>' + esc(guidance.document || finding.source || "BarrierCheck rule bank") + '</p></div>' +
          '<div class="cr-wide"><b>Evidence</b><p>' + esc(evidenceText(evidence)) + '</p></div>' +
          (finding.inspectorNotes ? '<div class="cr-wide"><b>Inspector note</b><p>' + esc(finding.inspectorNotes) + '</p></div>' : '') +
        '</div></article>';
    });
    html += '</section>';
    return html;
  }

  function renderInspectionDetails(registry) {
    var html = '<section class="cr-section"><h2>Detailed Inspection Results</h2><p class="cr-intro">Passed checks are grouped to keep the report concise. Measurements, non-pass results and recorded values are shown individually.</p>';

    var details = document.querySelector("#details .section-card");
    if (details) html += renderSubsection("Inspection & Property Details", details, registry);

    html += renderBarrierLayout(parseLayout());

    Array.prototype.slice.call(document.querySelectorAll('#barrier .fence-card[data-section="fence"]')).forEach(function (card, index) {
      html += renderSubsection(contextualTitle(card, "Fence " + (index + 1)), card, registry);
    });

    Array.prototype.slice.call(document.querySelectorAll("#barrier .streamline-additional-components .barrier-check-group")).forEach(function (group) {
      if (isVisible(group)) html += renderSubsection(contextualTitle(group, "Additional Barrier Component"), group, registry);
    });

    Array.prototype.slice.call(document.querySelectorAll("#climbability .climbability-card")).forEach(function (card, index) {
      html += renderSubsection(contextualTitle(card, "NCZ — Fence " + (index + 1)), card, registry);
    });

    Array.prototype.slice.call(document.querySelectorAll("#gate .gate-card")).forEach(function (card, index) {
      html += renderSubsection(contextualTitle(card, "Gate " + (index + 1)), card, registry);
    });

    var safety = document.querySelector("#safety .section-card");
    if (safety) html += renderSubsection("Safety / Outcome", safety, registry);

    html += '</section>';
    return html;
  }

  function reportHeader(findings) {
    var company = clean((document.getElementById("reportCompanyName") || {}).textContent) || "BarrierCheck Inspection Report";
    var meta = clean((document.getElementById("reportBusinessMeta") || {}).textContent);
    var address = valueOf("propertyAddress") || "—";
    var number = valueOf("inspectionNumber") || "—";
    var date = displayDate(valueOf("inspectionDate"));
    var owner = valueOf("ownerName") || valueOf("clientName") || "—";
    var result = valueOf("overallInspectionResult") || valueOf("certificateReadyToIssue") || "Not recorded";
    var resultClass = /fail|non|not ready|no/i.test(result) ? "fail" : (/pass|compliant|ready|yes/i.test(result) ? "pass" : "value");

    return '<header class="cr-header">' +
      '<div class="cr-brand"><div><div class="cr-kicker">Pool Safety Inspection Report</div><h1>' + esc(company) + '</h1>' + (meta ? '<p>' + esc(meta) + '</p>' : '') + '</div><div class="cr-version">Report ' + esc(REPORT_VERSION) + '</div></div>' +
      '<table class="cr-meta"><tbody>' +
        '<tr><th>Property</th><td colspan="3">' + esc(address) + '</td></tr>' +
        '<tr><th>Inspection No.</th><td>' + esc(number) + '</td><th>Date</th><td>' + esc(date) + '</td></tr>' +
        '<tr><th>Client / Owner</th><td>' + esc(owner) + '</td><th>Recorded outcome</th><td><span class="cr-status cr-' + resultClass + '">' + esc(result) + '</span></td></tr>' +
      '</tbody></table>' +
      '<div class="cr-summary-strip"><div><strong>' + findings.length + '</strong><span>Generated finding' + (findings.length === 1 ? '' : 's') + '</span></div><div class="cr-summary-note">The report below is written for a general reader. Technical requirements and source documents are shown with each finding.</div></div>' +
    '</header>';
  }

  function renderAppendix(registry) {
    if (!registry.photos.length) return '<section class="cr-appendix cr-page-break"><h2>Appendix A — Photographic Evidence</h2><div class="cr-empty">No inspection photographs were recorded.</div></section>';
    var chunks = [];
    for (var i = 0; i < registry.photos.length; i += 4) chunks.push(registry.photos.slice(i, i + 4));

    return chunks.map(function (chunk, pageIndex) {
      return '<section class="cr-appendix ' + (pageIndex === 0 ? 'cr-page-break' : 'cr-photo-page') + '">' +
        '<div class="cr-appendix-title"><h2>Appendix A — Photographic Evidence</h2><span>Page ' + (pageIndex + 1) + ' of ' + chunks.length + '</span></div>' +
        '<div class="cr-photo-grid">' + chunk.map(function (photo) {
          return '<figure><div class="cr-photo-code">' + esc(photo.code) + '</div><img src="' + esc(photo.src) + '" alt="' + esc(photo.code) + '"><figcaption>' + esc(photo.caption) + '</figcaption></figure>';
        }).join("") + '</div></section>';
    }).join("");
  }

  function sourceNote() {
    return '<section class="cr-source-note"><strong>How to read the requirements:</strong> BarrierCheck shows a plain-English requirement summary and, where mapped, a short key quotation with the source clause. Queensland Development Code MP 3.4 modifies the referenced AS 1926.1—2007 and AS 1926.2—2007 provisions and prevails to the extent of any inconsistency. Short quotations are included only to identify the key requirement; refer to the cited source document for the complete provision.</section>';
  }

  function injectReportStyles() {
    if (document.getElementById("compactReportStyles")) return;
    var style = document.createElement("style");
    style.id = "compactReportStyles";
    style.textContent = [
      "#compactReportRoot{display:none}",
      "body.compact-report-mode{background:#fff!important}",
      "body.compact-report-mode>.app-shell{display:none!important}",
      "body.compact-report-mode #compactReportRoot{display:block;max-width:210mm;margin:0 auto;background:#fff;color:#172b3a;font:9.2pt/1.35 Arial,sans-serif;padding:10mm}",
      ".cr-header{border-bottom:2px solid #0d82d8;padding-bottom:4mm;margin-bottom:4mm}",
      ".cr-brand{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}",
      ".cr-brand h1{margin:1mm 0 0;color:#03286a;font-size:18pt;line-height:1}",
      ".cr-brand p{margin:2mm 0 0;color:#5c6373;font-size:8pt}",
      ".cr-kicker{text-transform:uppercase;letter-spacing:.08em;font-size:7.5pt;font-weight:700;color:#0d82d8}",
      ".cr-version{font-size:7pt;color:#7d8992;white-space:nowrap}",
      ".cr-meta,.cr-table{width:100%;border-collapse:collapse;margin-top:3mm}",
      ".cr-meta th,.cr-meta td,.cr-table th,.cr-table td{border:1px solid #dce6ec;padding:1.6mm 2mm;vertical-align:top}",
      ".cr-meta th,.cr-table th{width:25%;text-align:left;background:#f2f7fa;color:#28485c;font-weight:700}",
      ".cr-summary-strip{display:grid;grid-template-columns:32mm 1fr;gap:4mm;align-items:center;margin-top:3mm;padding:2.5mm 3mm;background:#f4f9fc;border:1px solid #dceaf0;border-radius:3mm}",
      ".cr-summary-strip>div:first-child{display:flex;align-items:baseline;gap:2mm}",
      ".cr-summary-strip strong{font-size:18pt;color:#03286a}.cr-summary-strip span{font-size:8pt;color:#5c6373}",
      ".cr-summary-note{font-size:8pt;color:#4e606b}",
      ".cr-section{margin:0 0 4mm}.cr-section>h2,.cr-appendix h2{margin:0 0 2mm;color:#03286a;font-size:12pt;border-bottom:1px solid #b9d7e5;padding-bottom:1mm}",
      ".cr-intro{margin:0 0 2.5mm;color:#52656f;font-size:8pt}",
      ".cr-subsection{margin:0 0 3mm;break-inside:auto}.cr-subsection h3{margin:0;background:#eaf5fb;border-left:3px solid #0d82d8;padding:1.4mm 2mm;color:#133f58;font-size:9.4pt}",
      ".cr-table{margin-top:0;font-size:8pt}.cr-table tr{break-inside:avoid}.cr-table .cr-pass td{color:#22653a}.cr-table .cr-fail th,.cr-table .cr-fail td{background:#fff0f0;color:#932828;font-weight:700}.cr-table .cr-na td{color:#6e7b83}",
      ".cr-finding{border:1px solid #e2baba;border-left:4px solid #c62828;border-radius:2mm;margin:0 0 3mm;break-inside:avoid;background:#fff}",
      ".cr-finding-head{display:flex;gap:2mm;align-items:center;padding:2mm 2.5mm;background:#fff4f4;border-bottom:1px solid #efd2d2}.cr-finding-head span{font-size:7.5pt;font-weight:800;color:#fff;background:#c62828;border-radius:99px;padding:.8mm 1.6mm}.cr-finding-head strong{color:#7e1c1c;font-size:9.2pt}",
      ".cr-finding-grid{display:grid;grid-template-columns:1fr 1fr}.cr-finding-grid>div{padding:2mm 2.5mm;border-right:1px solid #edf0f2;border-bottom:1px solid #edf0f2}.cr-finding-grid>div:nth-child(2n){border-right:0}.cr-finding-grid .cr-wide{grid-column:1/-1;border-right:0}.cr-finding-grid b{display:block;color:#304c5f;font-size:7.6pt;margin-bottom:.8mm}.cr-finding-grid p{margin:0;font-size:8pt}.cr-quote{margin-top:1mm!important;font-style:italic;color:#3b5060}.cr-plain{margin-top:1mm!important;color:#3d6b55}",
      ".cr-status{display:inline-block;border-radius:99px;padding:.7mm 1.8mm;font-weight:700}.cr-status.cr-pass{background:#e8f5ec;color:#1f6c38}.cr-status.cr-fail{background:#fdeaea;color:#9d2424}.cr-status.cr-value{background:#edf3f6;color:#405966}",
      ".cr-empty{padding:3mm;border:1px dashed #c7d6de;background:#fafcfd;color:#5f6f78}",
      ".cr-source-note{margin:4mm 0;padding:2.5mm 3mm;border:1px solid #d7e5eb;background:#f7fafc;color:#52646e;font-size:7.5pt;break-inside:avoid}",
      ".cr-appendix{margin-top:0}.cr-appendix-title{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid #b9d7e5;margin-bottom:3mm}.cr-appendix-title h2{border:0;margin:0}.cr-appendix-title span{font-size:7.5pt;color:#6d7c84;padding-bottom:1mm}",
      ".cr-photo-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(2,1fr);gap:5mm;height:252mm}.cr-photo-grid figure{margin:0;border:1px solid #d7e2e7;border-radius:2mm;padding:2.5mm;display:flex;flex-direction:column;min-height:0;break-inside:avoid}.cr-photo-code{font-weight:800;color:#03286a;font-size:8pt;margin-bottom:1.5mm}.cr-photo-grid img{width:100%;height:92mm;object-fit:contain;background:#f5f7f8}.cr-photo-grid figcaption{margin-top:1.5mm;font-size:7.5pt;color:#4f606a;line-height:1.25}",
      ".cr-page-break{break-before:page;page-break-before:always}.cr-photo-page{break-before:page;page-break-before:always}",
      "@media screen{body.compact-report-mode #compactReportRoot{box-shadow:0 0 30px rgba(0,0,0,.12);margin-top:16px;margin-bottom:70px}.download-close-btn{z-index:1000000!important}}",
      "@media print{@page{size:A4;margin:8mm 9mm}html,body{background:#fff!important}body.compact-report-mode #compactReportRoot{display:block!important;max-width:none!important;margin:0!important;padding:0!important;font-size:8.6pt!important}body.compact-report-mode>.app-shell,body.compact-report-mode .download-close-btn{display:none!important}.cr-header{break-after:avoid}.cr-finding{break-inside:avoid}.cr-subsection h3{break-after:avoid}.cr-photo-grid{height:260mm}.cr-photo-grid img{height:96mm}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function buildCompactReport() {
    injectReportStyles();
    var existing = document.getElementById("compactReportRoot");
    if (existing) existing.remove();

    if (typeof window.refreshSummary === "function") window.refreshSummary();
    var findings = typeof window.collectFindings === "function" ? window.collectFindings() : [];
    var registry = buildPhotoRegistry();

    var root = document.createElement("main");
    root.id = "compactReportRoot";
    root.setAttribute("aria-label", "BarrierCheck printable inspection report");
    root.innerHTML = reportHeader(findings) + renderFindings(findings, registry) + renderInspectionDetails(registry) + sourceNote() + renderAppendix(registry);
    document.body.appendChild(root);
    return root;
  }

  window.enterDownloadMode = function () {
    buildCompactReport();
    document.body.classList.add("download-mode", "compact-report-mode");
    if (typeof window.ensureDownloadCloseButton === "function") window.ensureDownloadCloseButton();
    var closeBtn = document.getElementById("downloadCloseBtn");
    if (closeBtn) closeBtn.hidden = false;
    window.scrollTo(0, 0);
    window.setTimeout(function () { window.print(); }, 120);
  };

  window.closeDownloadMode = function () {
    var root = document.getElementById("compactReportRoot");
    if (root) root.remove();
    document.body.classList.remove("compact-report-mode");
    if (typeof originalCloseDownloadMode === "function") return originalCloseDownloadMode.apply(this, arguments);
    document.body.classList.remove("download-mode");
    var closeBtn = document.getElementById("downloadCloseBtn");
    if (closeBtn) closeBtn.hidden = true;
  };
})();
