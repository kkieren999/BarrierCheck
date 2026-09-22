// BarrierCheck customer-facing report generator v2.
// Customer PDF contains only the inspection outcome, identified issues, rectification guidance and referenced evidence.
(function () {
  "use strict";

  var REPORT_VERSION = "20260810.2";
  var priorCloseDownloadMode = window.closeDownloadMode;

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
    if (typeof window.formatDate === "function" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return window.formatDate(value);
    return value;
  }

  function library() {
    return window.BARRIER_CHECK_RECTIFICATION_LIBRARY || { rules: {}, reportPolicy: {}, sourceRegister: {} };
  }

  function fillTemplate(template, finding) {
    var replacements = {
      location: finding.item || finding.field || "the inspected area",
      item: finding.item || "the inspected item",
      field: finding.field || "item",
      value: finding.value || "",
      requirement: finding.requirement || ""
    };
    return clean(template).replace(/\{(location|item|field|value|requirement)\}/g, function (_, key) {
      return replacements[key] === undefined || replacements[key] === null ? "" : String(replacements[key]);
    });
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
    var slug = clean(area).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 12);
    return "IMG-" + (slug || "GEN");
  }

  function contextualTitle(el, fallback) {
    if (!el) return fallback || "Inspection evidence";
    var selectors = [
      ".streamline-card-summary h3", ".fence-card-head h3", ".barrier-check-title h3",
      ".climbability-section-title h3", ".gate-section-title h3", ".section-heading h2", "h3"
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      var node = el.querySelector(selectors[i]);
      if (node && clean(node.textContent)) return clean(node.textContent);
    }
    return fallback || "Inspection evidence";
  }

  function buildPhotoRegistry() {
    var photos = [];
    var counts = {};
    Array.prototype.slice.call(document.querySelectorAll(".photo-widget")).forEach(function (widget) {
      var area = clean(widget.getAttribute("data-photo-area"));
      if (!area) return;
      var prefix = photoPrefix(area);
      var context = widget.closest(".fence-card, .barrier-check-group, .climbability-card, .climbability-section-group, .gate-card, .gate-section-group, .section-card") || widget.parentElement;
      var caption = contextualTitle(context, area);
      Array.prototype.slice.call(widget.querySelectorAll(".photo-box")).forEach(function (box) {
        var img = box.querySelector("img");
        if (!img || !img.src) return;
        counts[prefix] = (counts[prefix] || 0) + 1;
        var code = prefix + "-" + String(counts[prefix]).padStart(2, "0");
        photos.push({ code: code, area: area, src: img.src, caption: caption });
      });
    });
    return photos;
  }

  function findingEvidence(finding, photos) {
    var text = [finding.item, finding.field, finding.id].map(clean).join(" ");
    var areas = [];
    var match;
    match = /fence(?: section)?\s*(\d+)/i.exec(text); if (match) areas.push("fence-" + match[1]);
    match = /(?:ncz|climbability)(?: section| check| \/ climbable object)?\s*(\d+)/i.exec(text); if (match) areas.push("climbability-" + match[1]);
    match = /gate\s*(\d+)/i.exec(text); if (match) areas.push("gate-" + match[1]);
    return photos.filter(function (photo) { return areas.indexOf(photo.area) !== -1; });
  }

  function sourcesText(rule, finding) {
    if (rule && Array.isArray(rule.sources) && rule.sources.length) {
      return rule.sources.map(function (source) {
        return clean(source.document) + (source.clause ? ", " + clean(source.clause) : "");
      }).join("; ");
    }
    return clean(finding.source || "BarrierCheck rule bank");
  }

  function listHtml(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return '<ul>' + items.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join("") + '</ul>';
  }

  function renderFinding(finding, index, photos, referencedCodes) {
    var lib = library();
    var rule = lib.rules && lib.rules[finding.id] ? lib.rules[finding.id] : null;
    var evidence = findingEvidence(finding, photos);
    evidence.forEach(function (photo) { referencedCodes[photo.code] = true; });

    var title = rule && rule.customerTitle ? rule.customerTitle : (finding.item || finding.field || "Inspection issue");
    var problem = rule && rule.customerProblemTemplate ? fillTemplate(rule.customerProblemTemplate, finding) : clean(finding.issue || ((finding.field || "Item") + " was recorded as " + (finding.value || "Fail") + "."));
    var why = rule && rule.whyItMatters ? rule.whyItMatters : clean(finding.risk || "This condition may reduce the effectiveness of the pool safety barrier.");
    var requirement = rule && rule.requirementSummary ? rule.requirementSummary : clean(finding.requirement || "The item must satisfy the applicable pool safety requirement.");
    var options = rule && rule.possibleRectificationOptions && rule.possibleRectificationOptions.length ? rule.possibleRectificationOptions : [clean(finding.recommendation || "Rectify the item so it satisfies the applicable pool safety requirement.")];
    var itemTypes = rule && rule.possibleItemTypes ? rule.possibleItemTypes : [];
    var evidenceText = evidence.length ? "Refer to " + evidence.map(function (photo) { return photo.code; }).join(", ") + " in Appendix A." : "No specific report photograph is linked to this finding.";

    return '<article class="bc2-finding">' +
      '<div class="bc2-finding-head"><span>F' + String(index + 1).padStart(2, "0") + '</span><div><strong>' + esc(title) + '</strong><small>' + esc(finding.item || finding.field || "") + '</small></div></div>' +
      '<div class="bc2-block"><b>What needs attention</b><p>' + esc(problem) + '</p></div>' +
      '<div class="bc2-block"><b>Why this matters</b><p>' + esc(why) + '</p></div>' +
      '<div class="bc2-block"><b>Requirement</b><p>' + esc(requirement) + '</p><p class="bc2-source"><strong>Source:</strong> ' + esc(sourcesText(rule, finding)) + '</p></div>' +
      '<div class="bc2-block bc2-options"><b>Possible ways to rectify the issue</b>' + listHtml(options) + '</div>' +
      (itemTypes.length ? '<div class="bc2-block bc2-items"><b>Examples of repair/component types that may be suitable</b>' + listHtml(itemTypes) + '<p class="bc2-small">These are generic examples only, not product approvals or guarantees of compliance.</p></div>' : '') +
      '<div class="bc2-block bc2-evidence"><b>Evidence</b><p>' + esc(evidenceText) + '</p></div>' +
    '</article>';
  }

  function renderFindings(findings, photos, referencedCodes) {
    if (!findings.length) {
      return '<section class="bc2-section"><h2>Inspection outcome</h2><div class="bc2-compliant"><strong>No non-compliance findings were generated from the recorded inspection.</strong><p>The detailed inspection record remains stored in BarrierCheck.</p></div></section>';
    }
    return '<section class="bc2-section"><h2>Items requiring attention</h2><p class="bc2-intro">The items below explain what needs attention, why it matters and possible ways the issue may be rectified.</p>' +
      findings.map(function (finding, index) { return renderFinding(finding, index, photos, referencedCodes); }).join("") +
    '</section>';
  }

  function reportHeader(findings) {
    var company = clean((document.getElementById("reportCompanyName") || {}).textContent) || "BarrierCheck Inspection Report";
    var businessMeta = clean((document.getElementById("reportBusinessMeta") || {}).textContent);
    var address = valueOf("propertyAddress") || "—";
    var number = valueOf("inspectionNumber") || "—";
    var date = displayDate(valueOf("inspectionDate"));
    var owner = valueOf("ownerName") || valueOf("clientName") || "—";
    var result = valueOf("overallInspectionResult") || valueOf("certificateReadyToIssue") || (findings.length ? "Non-compliant items identified" : "No non-compliance findings generated");
    var resultClass = findings.length ? "fail" : (/fail|non|not ready|no/i.test(result) ? "fail" : "pass");

    return '<header class="bc2-header">' +
      '<div class="bc2-brand"><div><div class="bc2-kicker">Pool Safety Inspection Findings & Rectification Guide</div><h1>' + esc(company) + '</h1>' + (businessMeta ? '<p>' + esc(businessMeta) + '</p>' : '') + '</div><span class="bc2-version">' + esc(REPORT_VERSION) + '</span></div>' +
      '<table class="bc2-meta"><tbody>' +
        '<tr><th>Property</th><td colspan="3">' + esc(address) + '</td></tr>' +
        '<tr><th>Inspection No.</th><td>' + esc(number) + '</td><th>Date</th><td>' + esc(date) + '</td></tr>' +
        '<tr><th>Client / Owner</th><td>' + esc(owner) + '</td><th>Outcome</th><td><span class="bc2-status bc2-' + resultClass + '">' + esc(result) + '</span></td></tr>' +
      '</tbody></table>' +
      (findings.length ? '<div class="bc2-summary"><strong>' + findings.length + '</strong><span>item' + (findings.length === 1 ? '' : 's') + ' requiring attention</span></div>' : '') +
    '</header>';
  }

  function guidanceNote() {
    var lib = library();
    var policy = lib.reportPolicy || {};
    var disclaimer = clean(policy.rectificationDisclaimer || "Possible rectification options are examples only. The selected repair must suit the actual barrier and site conditions, satisfy the applicable requirements and be confirmed by inspection after the work is complete.");
    return '<section class="bc2-guidance"><h2>Important information about rectification</h2><p>' + esc(disclaimer) + '</p><p>Where a component type is mentioned, it is a generic example only. The report does not endorse a particular brand, retailer or product.</p></section>';
  }

  function nextSteps(findings) {
    if (!findings.length) return "";
    return '<section class="bc2-next"><h2>What happens next?</h2><ol><li>Arrange rectification of the items listed above.</li><li>Ensure the completed work does not create another barrier or non-climbable-zone issue.</li><li>Contact your pool safety inspector when the work is complete so the rectified items can be reassessed.</li></ol></section>';
  }

  function sourceNote() {
    return '<section class="bc2-source-note"><strong>Requirement references:</strong> Queensland Development Code MP 3.4 modifies the referenced AS 1926.1—2007 and AS 1926.2—2007 provisions and prevails to the extent of any inconsistency. This report uses plain-English summaries and clause references rather than reproducing substantial portions of the Australian Standards.</section>';
  }

  function renderAppendix(photos, referencedCodes) {
    var selected = photos.filter(function (photo) { return !!referencedCodes[photo.code]; });
    if (!selected.length) return "";
    var chunks = [];
    for (var i = 0; i < selected.length; i += 4) chunks.push(selected.slice(i, i + 4));
    return chunks.map(function (chunk, pageIndex) {
      return '<section class="bc2-appendix bc2-page-break"><div class="bc2-app-head"><h2>Appendix A — Referenced photographic evidence</h2><span>' + (pageIndex + 1) + ' / ' + chunks.length + '</span></div><div class="bc2-photo-grid">' +
        chunk.map(function (photo) {
          return '<figure><div class="bc2-code">' + esc(photo.code) + '</div><img src="' + esc(photo.src) + '" alt="' + esc(photo.code) + '"><figcaption>' + esc(photo.caption) + '</figcaption></figure>';
        }).join("") + '</div></section>';
    }).join("");
  }

  function injectStyles() {
    if (document.getElementById("customerReportV2Styles")) return;
    var style = document.createElement("style");
    style.id = "customerReportV2Styles";
    style.textContent = [
      "#customerReportV2Root{display:none}",
      "body.customer-report-v2{background:#fff!important}",
      "body.customer-report-v2>.app-shell{display:none!important}",
      "body.customer-report-v2 #customerReportV2Root{display:block;max-width:210mm;margin:0 auto;padding:10mm;background:#fff;color:#173044;font:9.2pt/1.4 Arial,sans-serif}",
      ".bc2-header{border-bottom:2px solid #0d82d8;padding-bottom:4mm;margin-bottom:4mm}",
      ".bc2-brand{display:flex;justify-content:space-between;gap:4mm}.bc2-brand h1{margin:1mm 0 0;color:#03286a;font-size:18pt}.bc2-brand p{margin:1.5mm 0 0;color:#5e6d77;font-size:8pt}.bc2-kicker{font-size:7.4pt;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#0d82d8}.bc2-version{font-size:7pt;color:#8a969d}",
      ".bc2-meta{width:100%;border-collapse:collapse;margin-top:3mm}.bc2-meta th,.bc2-meta td{border:1px solid #dce5ea;padding:1.6mm 2mm;vertical-align:top}.bc2-meta th{width:23%;background:#f3f7f9;text-align:left;color:#345164}",
      ".bc2-status{display:inline-block;padding:.7mm 1.8mm;border-radius:99px;font-weight:800}.bc2-fail{background:#fdecec;color:#9d2424}.bc2-pass{background:#e9f5ec;color:#23663a}",
      ".bc2-summary{display:flex;align-items:baseline;gap:2mm;margin-top:3mm;padding:2.5mm 3mm;background:#fff4f4;border:1px solid #efd2d2;border-radius:2mm}.bc2-summary strong{font-size:18pt;color:#b3261e}.bc2-summary span{color:#6b3c3a}",
      ".bc2-section,.bc2-guidance,.bc2-next{margin-bottom:4mm}.bc2-section>h2,.bc2-guidance h2,.bc2-next h2,.bc2-appendix h2{margin:0 0 2mm;color:#03286a;font-size:12pt;border-bottom:1px solid #bed8e5;padding-bottom:1mm}.bc2-intro{margin:0 0 3mm;color:#536773;font-size:8.3pt}",
      ".bc2-finding{border:1px solid #e5c0bd;border-left:4px solid #c62828;margin:0 0 3.5mm;border-radius:2mm;break-inside:avoid;background:#fff}.bc2-finding-head{display:flex;gap:2mm;align-items:center;padding:2mm 2.5mm;background:#fff5f4;border-bottom:1px solid #efd6d3}.bc2-finding-head>span{background:#c62828;color:#fff;font-weight:800;border-radius:99px;padding:.8mm 1.6mm;font-size:7.5pt}.bc2-finding-head strong{display:block;color:#7f211b;font-size:10pt}.bc2-finding-head small{display:block;color:#80635f;font-size:7.3pt;margin-top:.5mm}",
      ".bc2-block{padding:2mm 2.7mm;border-bottom:1px solid #edf0f2}.bc2-block:last-child{border-bottom:0}.bc2-block>b{display:block;color:#29495d;font-size:7.8pt;margin-bottom:.7mm}.bc2-block p{margin:0}.bc2-block ul{margin:1mm 0 0 4mm;padding-left:4mm}.bc2-block li{margin:.6mm 0}.bc2-source{margin-top:1.2mm!important;color:#536773;font-size:7.7pt}.bc2-options{background:#f7fbfd}.bc2-items{background:#fbfcfd}.bc2-small{margin-top:1mm!important;color:#687780;font-size:7.2pt;font-style:italic}.bc2-evidence{background:#f8fafb}",
      ".bc2-guidance,.bc2-next,.bc2-source-note,.bc2-compliant{padding:2.5mm 3mm;border:1px solid #d8e4ea;background:#f8fbfc;break-inside:avoid}.bc2-guidance p,.bc2-next p,.bc2-source-note p,.bc2-compliant p{margin:1mm 0 0}.bc2-next ol{margin:1mm 0 0 5mm;padding-left:4mm}.bc2-next li{margin:.7mm 0}.bc2-source-note{font-size:7.4pt;color:#536570;margin:4mm 0}",
      ".bc2-page-break{break-before:page;page-break-before:always}.bc2-app-head{display:flex;justify-content:space-between;align-items:flex-end}.bc2-app-head span{font-size:7pt;color:#76838b}.bc2-photo-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(2,1fr);gap:5mm;height:252mm}.bc2-photo-grid figure{margin:0;border:1px solid #d7e2e7;border-radius:2mm;padding:2.5mm;display:flex;flex-direction:column}.bc2-code{font-weight:800;color:#03286a;margin-bottom:1.5mm}.bc2-photo-grid img{width:100%;height:92mm;object-fit:contain;background:#f5f7f8}.bc2-photo-grid figcaption{margin-top:1.5mm;font-size:7.5pt;color:#52636d}",
      "@media screen{body.customer-report-v2 #customerReportV2Root{box-shadow:0 0 30px rgba(0,0,0,.12);margin-top:16px;margin-bottom:70px}.download-close-btn{z-index:1000000!important}}",
      "@media print{@page{size:A4;margin:8mm 9mm}body.customer-report-v2 #customerReportV2Root{display:block!important;max-width:none!important;margin:0!important;padding:0!important}body.customer-report-v2>.app-shell,body.customer-report-v2 .download-close-btn{display:none!important}.bc2-finding{break-inside:avoid}.bc2-photo-grid{height:260mm}.bc2-photo-grid img{height:96mm}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function buildReport() {
    injectStyles();
    var oldCompact = document.getElementById("compactReportRoot");
    if (oldCompact) oldCompact.remove();
    var old = document.getElementById("customerReportV2Root");
    if (old) old.remove();
    if (typeof window.refreshSummary === "function") window.refreshSummary();

    var findings = typeof window.collectFindings === "function" ? window.collectFindings() : [];
    var photos = buildPhotoRegistry();
    var referencedCodes = {};
    var findingsHtml = renderFindings(findings, photos, referencedCodes);

    var root = document.createElement("main");
    root.id = "customerReportV2Root";
    root.setAttribute("aria-label", "Customer inspection findings and rectification guide");
    root.innerHTML = reportHeader(findings) + findingsHtml + guidanceNote() + nextSteps(findings) + sourceNote() + renderAppendix(photos, referencedCodes);
    document.body.appendChild(root);
    return root;
  }

  window.enterDownloadMode = function () {
    buildReport();
    document.body.classList.remove("compact-report-mode");
    document.body.classList.add("download-mode", "customer-report-v2");
    if (typeof window.ensureDownloadCloseButton === "function") window.ensureDownloadCloseButton();
    var closeBtn = document.getElementById("downloadCloseBtn");
    if (closeBtn) closeBtn.hidden = false;
    window.scrollTo(0, 0);
    window.setTimeout(function () { window.print(); }, 120);
  };

  window.closeDownloadMode = function () {
    var root = document.getElementById("customerReportV2Root");
    if (root) root.remove();
    document.body.classList.remove("customer-report-v2");
    if (typeof priorCloseDownloadMode === "function") return priorCloseDownloadMode.apply(this, arguments);
    document.body.classList.remove("download-mode");
    var closeBtn = document.getElementById("downloadCloseBtn");
    if (closeBtn) closeBtn.hidden = true;
  };
})();
