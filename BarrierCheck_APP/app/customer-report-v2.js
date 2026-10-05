// BarrierCheck customer-facing report generator v2.
// Customer PDF contains only the inspection outcome, identified issues, rectification guidance and referenced evidence.
(function () {
  "use strict";

  var REPORT_VERSION = "20261005.6";
  var priorCloseDownloadMode = window.closeDownloadMode;
  var CLIENT_REPORT_HIDDEN_FINDING_IDS = [
    "overall-result-fail",
    "observed-nonconformitynoticerequired",
    "observed-reinspectionrequired"
  ];

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
    var physicalCards = Array.prototype.slice.call(document.querySelectorAll(".fence-card"));
    Array.prototype.slice.call(document.querySelectorAll(".photo-widget")).forEach(function (widget) {
      var area = clean(widget.getAttribute("data-photo-area"));
      if (!area) return;
      var prefix = photoPrefix(area);
      var physicalCard = widget.closest(".fence-card");
      var physicalCardIndex = physicalCard ? physicalCards.indexOf(physicalCard) : -1;
      var structureKey = physicalCardIndex >= 0 ? "structure-card:" + physicalCardIndex : "";
      var context = physicalCard || widget.closest(".barrier-check-group, .climbability-card, .climbability-section-group, .gate-card, .gate-section-group, .section-card") || widget.parentElement;
      var caption = contextualTitle(context, area);
      Array.prototype.slice.call(widget.querySelectorAll(".photo-box")).forEach(function (box) {
        var img = box.querySelector("img");
        var fullSrc = "";
        if (box.dataset && box.dataset.photo) {
          try {
            var record = JSON.parse(box.dataset.photo);
            fullSrc = clean(record && (record.url || record.src));
          } catch (error) {}
        }
        if (!fullSrc && img && img.src) fullSrc = img.src;
        if (!fullSrc) return;
        counts[prefix] = (counts[prefix] || 0) + 1;
        var code = prefix + "-" + String(counts[prefix]).padStart(2, "0");
        photos.push({ code: code, area: area, structureKey: structureKey, src: fullSrc, caption: caption });
      });
    });
    return photos;
  }

  function findingEvidence(finding, photos) {
    var structureKey = clean(finding && finding.reportGroupKey);
    if (structureKey) {
      var structural = photos.filter(function (photo) {
        return clean(photo.structureKey) === structureKey;
      });
      if (structural.length) return structural;
    }

    var areas = Array.isArray(finding && finding.evidenceAreas)
      ? finding.evidenceAreas.map(clean).filter(function (area) { return !!area; })
      : [];

    var text = [finding && finding.item, finding && finding.field, finding && finding.id].map(clean).join(" ");
    var match;
    if (!areas.length) {
      match = /fence(?: section)?\s*(\d+)/i.exec(text); if (match) areas.push("fence-" + match[1]);
      match = /(?:ncz|climbability)(?: section| check| \/ climbable object)?\s*(\d+)/i.exec(text); if (match) areas.push("climbability-" + match[1]);
      match = /gate\s*(\d+)/i.exec(text); if (match) areas.push("gate-" + match[1]);
    }

    var direct = photos.filter(function (photo) { return areas.indexOf(photo.area) !== -1; });
    if (direct.length) return direct;

    var item = clean(finding && finding.item).toLowerCase();
    if (!item || item === "inspection item") return [];
    return photos.filter(function (photo) {
      var caption = clean(photo.caption).toLowerCase();
      return caption && (caption === item || caption.indexOf(item) !== -1 || item.indexOf(caption) !== -1);
    });
  }

  function filterClientFindings(findings) {
    return (findings || []).filter(function (finding) {
      return CLIENT_REPORT_HIDDEN_FINDING_IDS.indexOf(finding && finding.id) === -1;
    });
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

  function uniqueStrings(items) {
    var seen = {};
    return (items || []).map(clean).filter(function (item) {
      if (!item || seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }

  function reportLogicBank() {
    return window.BARRIER_CHECK_REPORT_LOGIC || { scenarios: [], duplicateRules: {} };
  }

  function suppressDuplicateClientFindings(findings) {
    var bank = reportLogicBank();
    var duplicates = bank.duplicateRules || {};
    var present = {};
    (findings || []).forEach(function (finding) {
      if (finding && finding.id) present[finding.id] = true;
    });

    return (findings || []).filter(function (finding) {
      var detailedIds = duplicates[finding && finding.id] || [];
      return !detailedIds.some(function (id) { return !!present[id]; });
    });
  }

  function hasAll(ids, required) {
    return (required || []).every(function (id) { return !!ids[id]; });
  }

  function hasAny(ids, options) {
    if (!options || !options.length) return true;
    return options.some(function (id) { return !!ids[id]; });
  }

  function scenarioMatch(findings, scenario) {
    var ids = {};
    (findings || []).forEach(function (finding) {
      if (finding && finding.id) ids[finding.id] = true;
    });

    if (!hasAll(ids, scenario.all || [])) return null;
    if (scenario.anyCause && scenario.anyCause.length && !hasAny(ids, scenario.anyCause)) return null;
    if (scenario.any && scenario.any.length && !hasAny(ids, scenario.any)) return null;

    if (scenario.matchIds && scenario.minMatches) {
      var count = scenario.matchIds.filter(function (id) { return !!ids[id]; }).length;
      if (count < scenario.minMatches) return null;
    }

    var consume = scenario.consume || scenario.matchIds || [];
    var matched = (findings || []).filter(function (finding) {
      return finding && consume.indexOf(finding.id) !== -1;
    });
    return matched.length ? matched : null;
  }

  function splitBucketByCausalLogic(bucket) {
    var remaining = (bucket.findings || []).slice();
    var result = [];
    var scenarios = (reportLogicBank().scenarios || []).slice().sort(function (a, b) {
      return (b.priority || 0) - (a.priority || 0);
    });

    scenarios.forEach(function (scenario) {
      var matched = scenarioMatch(remaining, scenario);
      if (!matched || matched.length < 2) return;

      var matchedSet = {};
      matched.forEach(function (finding) { matchedSet[finding.__reportIndex] = true; });
      result.push({
        key: bucket.key + ":scenario:" + scenario.id,
        findings: matched,
        scenario: scenario,
        order: Math.min.apply(Math, matched.map(function (finding) { return finding.__reportIndex; }))
      });
      remaining = remaining.filter(function (finding) { return !matchedSet[finding.__reportIndex]; });
    });

    remaining.forEach(function (finding) {
      result.push({
        key: bucket.key + ":single:" + finding.__reportIndex,
        findings: [finding],
        scenario: null,
        order: finding.__reportIndex
      });
    });

    return result;
  }

  function groupClientFindings(findings) {
    var filtered = suppressDuplicateClientFindings(findings);
    var buckets = [];
    var bucketMap = {};

    filtered.forEach(function (finding, index) {
      finding.__reportIndex = index;
      var key = clean(finding && finding.reportGroupKey);
      if (!key) key = "item:" + clean(finding && finding.item).toLowerCase();
      if (!key || key === "item:") key = "single-scope:" + index;

      if (!bucketMap[key]) {
        bucketMap[key] = { key: key, findings: [] };
        buckets.push(bucketMap[key]);
      }
      bucketMap[key].findings.push(finding);
    });

    var groups = [];
    buckets.forEach(function (bucket) {
      groups = groups.concat(splitBucketByCausalLogic(bucket));
    });
    groups.sort(function (a, b) { return a.order - b.order; });

    filtered.forEach(function (finding) {
      try { delete finding.__reportIndex; } catch (error) {}
    });
    return groups;
  }

  function ruleDetails(finding) {
    var lib = library();
    var rule = lib.rules && lib.rules[finding.id] ? lib.rules[finding.id] : null;
    return {
      finding: finding,
      rule: rule,
      problem: rule && rule.customerProblemTemplate ? fillTemplate(rule.customerProblemTemplate, finding) : clean(finding.issue || ((finding.field || "Item") + " was recorded as " + (finding.value || "Fail") + ".")),
      why: rule && rule.whyItMatters ? rule.whyItMatters : clean(finding.risk || "This condition may reduce the effectiveness of the pool safety barrier."),
      requirement: rule && rule.requirementSummary ? rule.requirementSummary : clean(finding.requirement || "The item must satisfy the applicable pool safety requirement."),
      options: rule && rule.possibleRectificationOptions && rule.possibleRectificationOptions.length ? rule.possibleRectificationOptions : [clean(finding.recommendation || "Rectify this item so it satisfies the applicable pool safety requirement.")],
      itemTypes: rule && rule.possibleItemTypes ? rule.possibleItemTypes : [],
      source: sourcesText(rule, finding)
    };
  }

  function groupEvidence(group, photos) {
    var byCode = {};
    var result = [];
    (group.findings || []).forEach(function (finding) {
      findingEvidence(finding, photos).forEach(function (photo) {
        if (!photo || byCode[photo.code]) return;
        byCode[photo.code] = true;
        result.push(photo);
      });
    });
    return result;
  }

  function renderInlineEvidence(evidence) {
    if (!evidence.length) return "";
    return '<div class="bc2-block bc2-evidence"><b>Photographic evidence</b><div class="bc2-inline-photo-grid">' +
      evidence.map(function (photo) {
        return '<figure><img src="' + esc(photo.src) + '" alt="' + esc(photo.code) + '"><figcaption><strong>' + esc(photo.code) + '</strong> — ' + esc(photo.caption) + '</figcaption><button class="bc2-photo-exclude" type="button">Exclude from this report</button></figure>';
      }).join("") +
    '</div></div>';
  }

  function scenarioText(value, item) {
    return clean(String(value || "").replace(/\{item\}/g, item || "this inspection area"));
  }

  function renderFindingGroup(group, index, photos, prefix) {
    var details = (group.findings || []).map(ruleDetails);
    if (!details.length) return "";

    var primary = details[0];
    var firstFinding = primary.finding;
    var item = clean(firstFinding.item || firstFinding.field || "Inspection issue");
    var scenario = group.scenario || null;
    var isGrouped = details.length > 1;
    var title = scenario ? scenarioText(scenario.title, item) : (isGrouped ? item : (primary.rule && primary.rule.customerTitle ? primary.rule.customerTitle : item));
    var subTitle = !scenario && !isGrouped && clean(firstFinding.item) && clean(firstFinding.item) !== clean(title) ? clean(firstFinding.item) : "";
    var evidence = groupEvidence(group, photos);

    var problemHtml = "";
    if (scenario) {
      problemHtml = '<p>' + esc(scenarioText(scenario.problem, item)) + '</p>' +
        '<p class="bc2-related-label">Recorded failed checks:</p>' +
        listHtml(uniqueStrings(details.map(function (detail) { return detail.finding.field; })));
    } else if (isGrouped) {
      problemHtml = '<p>Several related checks for ' + esc(item) + ' were recorded as non-compliant:</p>' +
        listHtml(uniqueStrings(details.map(function (detail) { return detail.finding.field; })));
    } else {
      problemHtml = '<p>' + esc(primary.problem) + '</p>';
    }

    var whyItems = scenario
      ? [scenarioText(scenario.why, item)]
      : uniqueStrings(details.map(function (detail) { return detail.why; }));
    var requirementItems = scenario
      ? [scenarioText(scenario.requirement, item)]
      : uniqueStrings(details.map(function (detail) { return detail.requirement; }));
    var sourceItems = uniqueStrings(details.map(function (detail) { return detail.source; }));
    var options = scenario && scenario.rectificationOptions
      ? uniqueStrings(scenario.rectificationOptions.map(function (option) { return scenarioText(option, item); }))
      : uniqueStrings([].concat.apply([], details.map(function (detail) { return detail.options || []; })));
    var itemTypes = scenario ? [] : uniqueStrings([].concat.apply([], details.map(function (detail) { return detail.itemTypes || []; })));
    var notes = uniqueStrings(details.map(function (detail) { return detail.finding.inspectorNotes; }));

    return '<article class="bc2-finding" data-report-group="' + esc(group.key) + '"' + (scenario ? ' data-report-scenario="' + esc(scenario.id) + '"' : '') + '>' +
      '<div class="bc2-finding-head"><span>' + esc(prefix || "F") + String(index + 1).padStart(2, "0") + '</span><div><strong>' + esc(title) + '</strong>' + (subTitle ? '<small>' + esc(subTitle) + '</small>' : '') + '</div></div>' +
      '<div class="bc2-block"><b>What needs attention</b>' + problemHtml + '</div>' +
      '<div class="bc2-block"><b>Why this matters</b>' + (whyItems.length === 1 ? '<p>' + esc(whyItems[0]) + '</p>' : listHtml(whyItems)) + '</div>' +
      '<div class="bc2-block"><b>Requirement</b>' + (requirementItems.length === 1 ? '<p>' + esc(requirementItems[0]) + '</p>' : listHtml(requirementItems)) +
        '<p class="bc2-source"><strong>Source:</strong> ' + esc(sourceItems.join("; ")) + '</p></div>' +
      '<div class="bc2-block bc2-options"><b>Possible ways to rectify the issue</b>' + listHtml(options) + '</div>' +
      (itemTypes.length ? '<div class="bc2-block bc2-items"><b>Examples of repair/component types that may be suitable</b>' + listHtml(itemTypes) + '<p class="bc2-small">These are generic examples only, not product approvals or guarantees of compliance.</p></div>' : '') +
      (notes.length ? '<div class="bc2-block"><b>Inspector notes</b>' + (notes.length === 1 ? '<p>' + esc(notes[0]) + '</p>' : listHtml(notes)) + '</div>' : '') +
      renderInlineEvidence(evidence) +
    '</article>';
  }

  function renderFindingSection(groups, photos, title, intro, prefix) {
    if (!groups.length) return "";
    return '<section class="bc2-section"><h2>' + esc(title) + '</h2><p class="bc2-intro">' + esc(intro) + '</p>' +
      groups.map(function (group, index) { return renderFindingGroup(group, index, photos, prefix); }).join("") +
    '</section>';
  }

  function renderNoFindings() {
    return '<section class="bc2-section"><h2>Inspection outcome</h2><div class="bc2-compliant"><strong>No non-compliance findings were generated from the recorded inspection.</strong><p>The detailed inspection record remains stored in BarrierCheck.</p></div></section>';
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
      ".bc2-inline-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3mm;margin-top:1.5mm}.bc2-inline-photo-grid figure{margin:0;border:1px solid #d7e2e7;border-radius:2mm;padding:1.5mm;background:#fff;break-inside:avoid;position:relative}.bc2-inline-photo-grid img{width:100%;height:58mm;object-fit:contain;background:#f5f7f8}.bc2-inline-photo-grid figcaption{margin-top:1mm;font-size:7.2pt;color:#52636d}.bc2-photo-exclude{margin-top:1.5mm;border:1px solid #c9dbe3;background:#fff;color:#36596b;border-radius:5px;padding:1.2mm 2mm;font-size:7pt;cursor:pointer}",
      ".bc2-related-label{margin-top:1.5mm!important;font-weight:700;color:#3d5664}.bc2-editable[contenteditable=true]{outline:1px dashed transparent;border-radius:2px;transition:outline-color .15s,background .15s}.bc2-editable[contenteditable=true]:hover{outline-color:#80b9d4;background:#f4fbff}.bc2-editable[contenteditable=true]:focus{outline:2px solid #0d82d8;background:#fff;box-shadow:0 0 0 2px rgba(13,130,216,.08)}",
      "#bc2EditorBar{position:fixed;z-index:1000002;left:50%;top:10px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100vw - 20px);padding:8px 10px;background:#0b3553;color:#fff;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.22);font:13px/1.25 Arial,sans-serif}#bc2EditorBar .bc2-editor-note{font-weight:700;margin-right:6px;white-space:nowrap}#bc2EditorBar button{border:0;border-radius:8px;padding:8px 11px;font-weight:700;cursor:pointer}#bc2EditorBar .bc2-print{background:#fff;color:#073158}#bc2EditorBar .bc2-reset{background:#dcedf6;color:#073158}#bc2EditorBar .bc2-close{background:#ffe7e5;color:#8b201b}",
      "@media screen{body.customer-report-v2 #customerReportV2Root{box-shadow:0 0 30px rgba(0,0,0,.12);margin-top:64px;margin-bottom:70px}.download-close-btn{display:none!important}}",
      "@media print{@page{size:A4;margin:8mm 9mm}body.customer-report-v2 #customerReportV2Root{display:block!important;max-width:none!important;margin:0!important;padding:0!important}body.customer-report-v2>.app-shell,body.customer-report-v2 .download-close-btn,#bc2EditorBar,.bc2-photo-exclude{display:none!important}.bc2-editable[contenteditable=true]{outline:0!important;background:transparent!important;box-shadow:none!important}.bc2-finding{break-inside:auto}.bc2-finding-head,.bc2-block{break-inside:avoid}.bc2-inline-photo-grid img{height:56mm}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function buildReport() {
    injectStyles();
    var oldCompact = document.getElementById("compactReportRoot");
    if (oldCompact) oldCompact.remove();
    var old = document.getElementById("customerReportV2Root");
    if (old) old.remove();
    if (typeof window.refreshSummary === "function") window.refreshSummary(true);

    var allFindings = typeof window.collectFindings === "function" ? window.collectFindings() : [];
    var findings = filterClientFindings(allFindings);
    var barrierFindings = findings.filter(function (finding) { return finding.category !== "referral" && finding.category !== "administrative"; });
    var referralFindings = findings.filter(function (finding) { return finding.category === "referral"; });
    var administrativeFindings = findings.filter(function (finding) { return finding.category === "administrative"; });

    var barrierGroups = groupClientFindings(barrierFindings);
    var referralGroups = groupClientFindings(referralFindings);
    var administrativeGroups = groupClientFindings(administrativeFindings);
    var groups = barrierGroups.concat(referralGroups, administrativeGroups);
    var photos = buildPhotoRegistry();
    var findingsHtml = findings.length
      ? renderFindingSection(
          barrierGroups,
          photos,
          "Pool barrier items requiring rectification",
          "Where recorded failures describe the same underlying physical condition, BarrierCheck combines them into one client-facing issue. Independent defects remain separate.",
          "F"
        ) +
        renderFindingSection(
          referralGroups,
          photos,
          "Other safety / specialist referrals",
          "These observations are recorded separately because they may require another qualified practitioner and are not, by themselves, additional pool-barrier nonconformities.",
          "R"
        ) +
        renderFindingSection(
          administrativeGroups,
          photos,
          "Administrative / process actions",
          "These items relate to certification, register or inspection-process actions rather than a separate physical barrier defect.",
          "A"
        )
      : renderNoFindings();

    var root = document.createElement("main");
    root.id = "customerReportV2Root";
    root.setAttribute("aria-label", "Customer inspection findings and rectification guide");
    root.innerHTML = reportHeader(groups) + findingsHtml + guidanceNote() + nextSteps(groups) + sourceNote();
    document.body.appendChild(root);

    var findingIds = [];
    groups.forEach(function (group) {
      (group.findings || []).forEach(function (finding) {
        if (finding && finding.id && findingIds.indexOf(finding.id) === -1) findingIds.push(finding.id);
      });
    });
    window.BARRIER_CHECK_CLIENT_REPORT_AUDIT_PENDING = {
      reportVersion: REPORT_VERSION,
      complianceEngineVersion: window.BARRIER_CHECK_COMPLIANCE_ENGINE && window.BARRIER_CHECK_COMPLIANCE_ENGINE.version || "",
      generatedAt: new Date().toISOString(),
      findingIds: findingIds,
      clientIssueGroups: groups.length,
      edited: false,
      lastEditedAt: "",
      printedAt: "",
      finalText: "",
      finalTextTruncated: false
    };
    return root;
  }

  function waitForReportImages(root) {
    var images = root ? Array.prototype.slice.call(root.querySelectorAll("img")) : [];
    if (!images.length) return Promise.resolve();

    return Promise.all(images.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (resolve) {
        var settled = false;
        function done() {
          if (settled) return;
          settled = true;
          resolve();
        }
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        window.setTimeout(done, 5000);
      });
    }));
  }

  function enableReportEditing(root) {
    if (!root) return;
    var selectors = [
      ".bc2-kicker",
      ".bc2-brand h1",
      ".bc2-brand p",
      ".bc2-meta td",
      ".bc2-section>h2",
      ".bc2-intro",
      ".bc2-finding-head strong",
      ".bc2-finding-head small",
      ".bc2-block p:not(.bc2-source)",
      ".bc2-block li",
      ".bc2-inline-photo-grid figcaption",
      ".bc2-guidance h2",
      ".bc2-guidance p",
      ".bc2-next h2",
      ".bc2-next li"
    ];

    Array.prototype.slice.call(root.querySelectorAll(selectors.join(","))).forEach(function (el) {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "true");
      el.classList.add("bc2-editable");
    });

    if (!root.dataset.auditEditBound) {
      root.dataset.auditEditBound = "1";
      root.addEventListener("input", function () {
        var audit = window.BARRIER_CHECK_CLIENT_REPORT_AUDIT_PENDING;
        if (!audit) return;
        audit.edited = true;
        audit.lastEditedAt = new Date().toISOString();
      });
    }

    Array.prototype.slice.call(root.querySelectorAll(".bc2-photo-exclude")).forEach(function (button) {
      button.addEventListener("click", function () {
        var figure = button.closest("figure");
        var grid = button.closest(".bc2-inline-photo-grid");
        var block = button.closest(".bc2-evidence");
        if (figure) figure.remove();
        if (grid && !grid.querySelector("figure") && block) block.remove();
        var audit = window.BARRIER_CHECK_CLIENT_REPORT_AUDIT_PENDING;
        if (audit) {
          audit.edited = true;
          audit.lastEditedAt = new Date().toISOString();
        }
      });
    });
  }

  function removeEditorBar() {
    var bar = document.getElementById("bc2EditorBar");
    if (bar) bar.remove();
  }

  function ensureEditorBar() {
    removeEditorBar();
    var bar = document.createElement("div");
    bar.id = "bc2EditorBar";
    bar.innerHTML =
      '<span class="bc2-editor-note">Report preview — click text to edit</span>' +
      '<button class="bc2-print" type="button">Print / Save PDF</button>' +
      '<button class="bc2-reset" type="button">Reset generated wording</button>' +
      '<button class="bc2-close" type="button">Close</button>';

    bar.querySelector(".bc2-print").addEventListener("click", function () {
      var root = document.getElementById("customerReportV2Root");
      var pending = window.BARRIER_CHECK_CLIENT_REPORT_AUDIT_PENDING;
      if (pending && root) {
        var reportText = String(root.innerText || root.textContent || "").trim();
        var maxAuditText = 30000;
        pending.printedAt = new Date().toISOString();
        pending.finalTextTruncated = reportText.length > maxAuditText;
        pending.finalText = reportText.slice(0, maxAuditText);
        window.BARRIER_CHECK_CLIENT_REPORT_AUDIT = JSON.parse(JSON.stringify(pending));
        if (typeof window.saveCurrentInspection === "function") window.saveCurrentInspection(false);
      }
      waitForReportImages(root).then(function () {
        window.setTimeout(function () { window.print(); }, 60);
      });
    });

    bar.querySelector(".bc2-reset").addEventListener("click", function () {
      var root = buildReport();
      enableReportEditing(root);
      window.scrollTo(0, 0);
    });

    bar.querySelector(".bc2-close").addEventListener("click", function () {
      window.closeDownloadMode();
    });

    document.body.appendChild(bar);
  }

  window.enterDownloadMode = function () {
    var reportRoot = buildReport();
    document.body.classList.remove("compact-report-mode");
    document.body.classList.add("download-mode", "customer-report-v2");
    var closeBtn = document.getElementById("downloadCloseBtn");
    if (closeBtn) closeBtn.hidden = true;
    enableReportEditing(reportRoot);
    ensureEditorBar();
    window.scrollTo(0, 0);
  };

  window.closeDownloadMode = function () {
    removeEditorBar();
    var root = document.getElementById("customerReportV2Root");
    if (root) root.remove();
    document.body.classList.remove("customer-report-v2");
    if (typeof priorCloseDownloadMode === "function") return priorCloseDownloadMode.apply(this, arguments);
    document.body.classList.remove("download-mode");
    var closeBtn = document.getElementById("downloadCloseBtn");
    if (closeBtn) closeBtn.hidden = true;
  };
})();
