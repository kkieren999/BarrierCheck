// BarrierCheck Queensland compliance engine.
// Cross-field decision logic sits here so client reporting, atomic checklist rules and
// inspector audit records can evolve independently.
(function () {
  "use strict";

  var ENGINE_VERSION = "2026-10-05-qld-compliance-v3";
  var SOURCE = "QDC MP 3.4 / AS 1926.1-2007 as modified / AS 1926.2-2007 as modified / Queensland pool safety inspector guideline effective 10 June 2024";
  var SOURCE_HIERARCHY = [
    "Queensland Development Code MP 3.4 - Swimming pool barriers",
    "AS 1926.1-2007 as called up and modified by QDC MP 3.4",
    "AS 1926.2-2007 as called up and modified by QDC MP 3.4",
    "Queensland pool safety inspector guideline effective 10 June 2024"
  ];

  function clean(value) {
    return String(value === undefined || value === null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function num(value) {
    if (value === undefined || value === null || clean(value) === "") return null;
    var result = Number(String(value).replace(/[^0-9.\-]/g, ""));
    return isNaN(result) ? null : result;
  }

  function field(root, name) {
    return (root || document).querySelector('[name="' + name + '"]');
  }

  function value(root, name) {
    var el = field(root, name);
    if (!el) return "";
    return el.type === "checkbox" ? (el.checked ? "Yes" : "No") : clean(el.value);
  }

  function poolEnvironment() {
    var explicit = value(document, "poolEnvironment");
    if (explicit) return explicit;
    var legacy = value(document, "poolType").toLowerCase();
    if (legacy.indexOf("indoor") !== -1) return "Indoor";
    if (legacy.indexOf("outdoor") !== -1) return "Outdoor";
    return "";
  }

  function confirmedAuthority() {
    var type = value(document, "specialAuthorityType");
    var status = value(document, "specialAuthorityStatus");
    var reference = value(document, "specialAuthorityReference");
    if (!(type && type !== "None / not applicable" && status === "Confirmed current" && reference)) return false;
    if (type === "Performance solution") {
      return value(document, "specialAuthorityRegisteredOnPoolRegister") === "Yes" &&
        !!value(document, "specialAuthorityForm17Reference");
    }
    return true;
  }

  function sourceRule(id, itemType, requirement, issue, risk, recommendation, category) {
    return {
      id: id,
      field: "",
      type: "derived",
      itemType: itemType,
      requirement: requirement,
      issueTemplate: issue,
      riskTemplate: risk,
      recommendationTemplate: recommendation,
      source: SOURCE,
      category: category || "barrier"
    };
  }

  function itemTitle(el) {
    if (typeof window.getFieldItemTitle === "function") return window.getFieldItemTitle(el);
    var card = el && el.closest ? el.closest(".fence-card, .section-card") : null;
    var heading = card && card.querySelector ? card.querySelector(".fence-card-head h3, h3, h2") : null;
    return heading ? clean(heading.textContent) : "Inspection item";
  }

  function labelFor(el) {
    if (typeof window.getFieldLabel === "function") return window.getFieldLabel(el);
    var label = el && el.closest ? el.closest("label") : null;
    var span = label && label.querySelector ? label.querySelector("span") : null;
    return span ? clean(span.textContent) : (el ? el.name : "Item");
  }

  function decisionResult(el, status, rule, opts) {
    opts = opts || {};
    var item = opts.item || itemTitle(el);
    var label = opts.label || labelFor(el);
    var recorded = opts.value !== undefined ? opts.value : (el ? (el.type === "checkbox" ? (el.checked ? "Yes" : "No") : el.value) : "");
    var result = {
      status: status,
      rule: rule,
      item: item,
      label: label,
      value: recorded,
      threshold: opts.threshold === undefined ? "" : opts.threshold,
      requirement: rule.requirement || "",
      decisionBasis: opts.decisionBasis || "",
      category: rule.category || "barrier"
    };
    if (status === "fail") {
      result.issue = opts.issue || rule.issueTemplate || "The recorded facts do not satisfy the applicable requirement.";
      result.risk = opts.risk || rule.riskTemplate || "The condition may compromise the pool barrier.";
      result.recommendation = opts.recommendation || rule.recommendationTemplate || "Rectify the item and reinspect before certification.";
    }
    return result;
  }

  var RULES = {
    fenceHeight: sourceRule(
      "qld-fence-effective-height-derived",
      "Fence",
      "Effective height must satisfy the applicable fence construction and aperture requirements.",
      "The recorded effective fence height does not satisfy the height required for this fence construction.",
      "Insufficient effective barrier height may make it easier for a young child to climb over the barrier.",
      "Increase or otherwise rectify the effective barrier height so the fence satisfies the applicable Queensland pool safety requirements."
    ),
    meshAperture: sourceRule(
      "qld-mesh-aperture-derived",
      "Fence",
      "Mesh/perforated fencing has construction-specific aperture and height requirements.",
      "The recorded mesh/perforated aperture arrangement does not satisfy the applicable requirements.",
      "Large or inadequately supported openings can compromise the barrier and assist access or climbing.",
      "Rectify the mesh/perforated barrier, including aperture size, effective height and required top/bottom strainer support."
    ),
    boundary: sourceRule(
      "qld-boundary-height-ncz-derived",
      "Boundary Fence",
      "A boundary fence may be 1200-1799mm only when the NCZ is on the outside; a fence 1800mm or higher may use the applicable inside or outside NCZ arrangement.",
      "The recorded boundary fence height and NCZ arrangement do not satisfy the Queensland boundary-fence modification.",
      "An inadequate boundary-fence height/NCZ arrangement may allow a young child to climb or access the pool area.",
      "Rectify the boundary fence height and/or NCZ arrangement and maintain the required additional clear area where the NCZ is outside."
    ),
    nczObject: sourceRule(
      "qld-ncz-object-derived",
      "NCZ Object",
      "Objects within the NCZ must not provide an accessible climbable handhold or foothold, subject to the Queensland upper-quadrant accessibility provision.",
      "The recorded object is within the NCZ and is an accessible climbable feature.",
      "The object may assist a young child to climb the barrier and access the pool area.",
      "Remove, relocate, shield or otherwise rectify the object/NCZ arrangement so it cannot assist climbing."
    ),
    waterDepth: sourceRule(
      "qld-water-depth-strict",
      "Permanent Body of Water",
      "A permanent body of water relied on as a barrier must be continuously more than 300mm deep in the relevant area.",
      "The recorded water depth is not continuously more than 300mm.",
      "Insufficient water depth means the water body cannot be relied on as the permitted barrier arrangement.",
      "Provide a compliant barrier arrangement or rectify the water-body configuration before relying on it as part of the pool barrier."
    ),
    waterComposite: sourceRule(
      "qld-water-barrier-composite",
      "Permanent Body of Water",
      "A permanent body of water relied on as a barrier must satisfy the Queensland depth, width, access and intersection-return/overhang conditions.",
      "One or more required conditions for using the permanent body of water as part of the pool barrier are not satisfied.",
      "A water body that does not satisfy all required conditions may allow access around, over or under the intended barrier.",
      "Rectify the water-body/barrier interface so all applicable depth, width, access and 900mm return/overhang conditions are satisfied."
    ),
    outdoorDoor: sourceRule(
      "qld-outdoor-building-door",
      "Building Access",
      "For an outdoor pool, direct access from a building must not be provided through a child-resistant doorset unless a valid recorded authority changes how the standard applies.",
      "A building door is being relied on for direct access control to an outdoor pool area without a confirmed applicable authority.",
      "A normal building door can be treated as an everyday access point and may allow a young child direct access to the pool area.",
      "Provide a compliant barrier/gate arrangement separating the building from the outdoor pool area, or record and apply a valid authority that lawfully changes the requirement."
    ),
    indoorDoor: sourceRule(
      "qld-indoor-doorset",
      "Indoor Pool Doorset",
      "An indoor-pool doorset must be child-resistant, self-closing, self-latching, open away from the pool, have the required latch-release height and no prohibited footholds/pet door.",
      "The recorded indoor-pool doorset does not satisfy all required child-resistant doorset conditions.",
      "A non-compliant doorset may allow a young child unsupervised access to the indoor pool.",
      "Rectify the doorset so all applicable child-resistant doorset requirements are satisfied."
    ),
    window: sourceRule(
      "qld-window-composite",
      "Barrier Window",
      "Where the external sill height to the pool area is below 1800mm, the openable window must satisfy the applicable child-resistant branch based on the internal sill height.",
      "The recorded window geometry and child-resistant treatment do not satisfy the applicable window branch.",
      "An inadequately restricted or protected window may permit a young child to gain access to the pool area.",
      "Rectify the window opening, screen/bars/flyscreen, fixings or sill arrangement so the applicable child-resistant window requirements are satisfied."
    ),
    retainingWall: sourceRule(
      "qld-retaining-wall-composite",
      "Retaining Wall",
      "Retaining walls used as or interacting with the barrier have different requirements depending on whether they are above or below pool level and how a fence intersects the wall.",
      "The recorded retaining-wall arrangement does not satisfy the applicable height, slope, NCZ or intersection-return requirements.",
      "A retaining wall or level change can create a climbable route or a gap around the pool barrier.",
      "Rectify the wall/barrier geometry, including any required 900mm return/overhang, so the arrangement satisfies the applicable requirements."
    ),
    balcony: sourceRule(
      "qld-balcony-composite",
      "Balcony / Deck",
      "A balcony/deck that projects into the pool area or is close to the barrier must use the applicable compliant barrier or NCZ arrangement.",
      "The recorded balcony/deck protection arrangement is not compliant for its measured drop/proximity.",
      "A balcony, deck or raised platform may provide a direct route over or around the pool barrier.",
      "Provide a compliant balustrade/barrier or the applicable NCZ arrangement and reinspect the completed work."
    ),
    chameleon: sourceRule(
      "qld-chameleon-gate",
      "Gate",
      "Chameleon gates are not permitted as part of the barrier for outdoor pools.",
      "A chameleon-gate arrangement is recorded for an outdoor pool.",
      "The arrangement provides direct building access to the pool area and is not an acceptable outdoor-pool barrier arrangement.",
      "Replace the arrangement with a compliant barrier/gate configuration that does not provide direct building access."
    ),
    doubleLeaf: sourceRule(
      "qld-double-leaf-gate",
      "Gate",
      "A twin-leaf gate requires a permanently fixed leaf or permanent central fixture and compliant self-closing/self-latching operation of the operable gate leaf/leaves.",
      "The recorded double-leaf gate arrangement does not satisfy the required permanent fixing and closing/latching conditions.",
      "An inadequately fixed or latched second leaf can defeat the pool gate barrier.",
      "Permanently fix the required leaf/fixture using an appropriate permanent method and ensure every operable leaf self-closes and self-latches."
    ),
    aboveGroundAccess: sourceRule(
      "qld-aboveground-designated-access",
      "Above-ground Pool",
      "An above-ground pool must have a designated pool access point enclosed by a compliant barrier including a compliant gate, whether or not a permanent ladder is installed.",
      "The designated access point for the above-ground/inflatable pool is not recorded as compliant.",
      "An uncontrolled ladder/access point can provide a direct climbing route into the pool.",
      "Provide and maintain a designated access point enclosed by a compliant barrier and gate, and keep ladders/filters from compromising the NCZ."
    ),
    decommissioning: sourceRule(
      "qld-decommissioning-conversion-approval",
      "Decommissioned / Converted Pool",
      "Current use as a fishpond or other use does not by itself remove a former swimming pool from the regulated-pool definition; the relevant conversion/destruction approval should be confirmed.",
      "The pool is recorded as converted to another use but final approval/certification that it is no longer a swimming pool has not been confirmed.",
      "The structure may remain a regulated pool despite its current use and may still require a compliant barrier.",
      "Confirm the relevant building approval/final inspection status or continue to treat the structure as a regulated pool requiring compliant barriers."
    ),
    temporaryExpired: sourceRule(
      "qld-temporary-fence-approval-expired",
      "Temporary Fencing",
      "Temporary-fencing approvals and permitted periods must be current for the inspection date.",
      "The recorded temporary-fencing approval expiry is before the inspection date.",
      "An expired temporary-fencing approval may mean the temporary arrangement can no longer be relied upon.",
      "Obtain the required current approval or reinstate/complete a compliant permanent barrier."
    )
  };

  RULES.highBarrier = sourceRule(
    "qld-mesh-high-barrier-ncz-exception",
    "Fence",
    "The QDC MP 3.4 NCZ/clear-area exception applies only to the qualifying mesh/perforated fence arrangements: at least 2400mm high, or at least 1800mm with the prescribed compliant cranked top.",
    "The recorded high-barrier/cranked-top arrangement does not satisfy the construction and height conditions for the NCZ/clear-area exception.",
    "Relying on an inapplicable NCZ exception can leave climbable access around the barrier.",
    "Use the ordinary NCZ/clear-area requirements, or rectify and verify the qualifying mesh/perforated high-barrier arrangement."
  );

  RULES.buildingWork = sourceRule(
    "qld-building-work-barrier",
    "Temporary Fencing / Building Work",
    "Building work must not compromise the pool barrier.",
    "Building work was recorded as compromising the pool barrier.",
    "Building work can create gaps or access points that allow a young child to enter the pool area.",
    "Provide effective temporary controls and reinstate/rectify the barrier so pool access remains restricted."
  );
  RULES.certificateReady = sourceRule(
    "certificate-ready-no",
    "Inspection Outcome",
    "A pool safety certificate should only be issued when the inspector is reasonably satisfied the regulated pool complies.",
    "The pool safety certificate is recorded as not ready to issue.",
    "Outstanding compliance or process items remain before certification.",
    "Resolve outstanding items and complete any required reinspection before issuing the certificate.",
    "administrative"
  );
  RULES.ownerAdvice = sourceRule(
    "owner-advised-actions-no",
    "Inspection Outcome",
    "Required rectification and process actions should be clearly communicated and recorded.",
    "The owner is recorded as not yet advised of required actions.",
    "The owner may not understand the rectification or reinspection steps required.",
    "Provide clear written advice and retain the communication in the inspection record.",
    "administrative"
  );

  var RULE_SOURCE_REFS = {
    fenceHeight: "AS 1926.1-2007 cl 2.1 and 2.3.2; QDC MP 3.4 Schedule 1 modifications",
    meshAperture: "AS 1926.1-2007 cl 2.3.2; QDC MP 3.4 Schedule 1 modification 12",
    boundary: "QDC MP 3.4 Schedule 1 modifications 6-10",
    nczObject: "QDC MP 3.4 Schedule 1 modifications 6-10; 2024 PSI guideline NCZ guidance",
    waterDepth: "QDC MP 3.4 Schedule 1 modification 17(a)",
    waterComposite: "QDC MP 3.4 Schedule 1 modification 17",
    outdoorDoor: "AS 1926.2-2007 cl 4.2 as modified by QDC MP 3.4; 2024 PSI guideline child-resistant doors",
    indoorDoor: "AS 1926.1-2007 cl 2.8; QDC MP 3.4 Schedule 1 modifications 15, 18 and 26",
    window: "AS 1926.1-2007 cl 2.7; QDC MP 3.4 Schedule 1 modification 26",
    retainingWall: "AS 1926.1-2007 cl 2.6; QDC MP 3.4 Schedule 1 modification 16",
    balcony: "AS 1926.1-2007 cl 2.9; QDC MP 3.4 Schedule 1 modifications 19-20",
    chameleon: "Queensland PSI guideline 2024, Chameleon gates",
    doubleLeaf: "Queensland PSI guideline 2024, Leaf (swing) gates",
    aboveGroundAccess: "AS 1926.1-2007 cl 2.10; QDC MP 3.4 Schedule 1 modification 21",
    decommissioning: "Queensland PSI guideline 2024, Decommissioning pools / Pools converted to fishponds",
    temporaryExpired: "QDC MP 3.4 Schedule 1 modifications 3-4; Queensland PSI guideline 2024, Temporary fencing",
    highBarrier: "QDC MP 3.4 Schedule 1 modification 12 (AS 1926.1-2007 cl 2.3.2)",
    buildingWork: "Queensland PSI guideline 2024, Temporary fencing / minor repairs and maintenance",
    certificateReady: "Queensland PSI guideline 2024, Conformity and being reasonably satisfied",
    ownerAdvice: "Queensland PSI guideline 2024, Nonconformity"
  };
  Object.keys(RULE_SOURCE_REFS).forEach(function (key) {
    if (RULES[key]) RULES[key].sourceRef = RULE_SOURCE_REFS[key];
  });

  function fenceRequiredHeightFacts(facts) {
    var aperture = num(facts.aperture);
    var type = clean(facts.type).toLowerCase();
    if (/mesh|chainwire|perforat/.test(type)) {
      if (aperture === null) return { status: "incomplete", basis: "Mesh/perforated aperture must be recorded before the required effective height can be derived." };
      if (aperture > 100) return { status: "known", threshold: 1800, apertureFail: true, basis: "Mesh/perforated aperture is greater than 100mm and is not permitted." };
      if (aperture > 13) return { status: "known", threshold: 1800, basis: "Mesh/perforated aperture >13mm and <=100mm requires at least 1800mm effective height." };
      return { status: "known", threshold: 1200, basis: "Mesh/perforated aperture <=13mm requires at least 1200mm effective height." };
    }
    return { status: "known", threshold: 1200, basis: "General effective-height requirement is at least 1200mm for this recorded construction." };
  }

  function boundaryFacts(facts) {
    var height = num(facts.height);
    if (height === null) return { status: "incomplete", basis: "Boundary height not recorded." };
    if (height < 1200) return { status: "fail", basis: "Boundary fence is below 1200mm." };
    if (!facts.nczSide || facts.nczSide === "Both / requires assessment") {
      return { status: "incomplete", basis: "Record the NCZ side being relied upon before the boundary-fence decision is complete." };
    }
    if (height < 1800) {
      if (!facts.clearArea) return { status: "incomplete", basis: "A 1200-1799mm boundary fence requires the outside NCZ and additional-clear-area assessment." };
      if (facts.nczSide === "Outside pool area" && facts.clearArea === "Pass") {
        return { status: "pass", basis: "Boundary fence is at least 1200mm, below 1800mm, with the NCZ outside and additional clear area maintained." };
      }
      return { status: "fail", basis: "A boundary fence between 1200mm and 1799mm must use the outside NCZ with the additional clear area maintained." };
    }
    if (facts.nczSide === "Outside pool area") {
      if (!facts.clearArea) return { status: "incomplete", basis: "Outside NCZ requires the additional-clear-area assessment." };
      return facts.clearArea === "Pass"
        ? { status: "pass", basis: "Boundary fence is at least 1800mm, outside NCZ selected and additional clear area maintained." }
        : { status: "fail", basis: "Outside NCZ is selected but the additional clear area is not compliant." };
    }
    return { status: "pass", basis: "Boundary fence is at least 1800mm with the inside NCZ selected." };
  }

  function waterFacts(facts) {
    var depth = num(facts.depth);
    var width = num(facts.width);
    var ret = num(facts.returnOverhang);
    if (depth === null || width === null || ret === null || !facts.accessBlocked || !facts.returnSurface) {
      return { status: "incomplete", basis: "Water-barrier assessment is missing one or more required facts." };
    }
    if (!(depth > 300)) return { status: "fail", basis: "Water depth must be continuously more than 300mm." };
    if (width < 1800) return { status: "fail", basis: "Water-body width immediately adjacent to the protected edge is below 1800mm." };
    if (facts.accessBlocked !== "Pass") return { status: "fail", basis: "Access over or under the water body is not recorded as prevented." };
    if (ret < 900) return { status: "fail", basis: "Required intersecting-barrier return/overhang is below 900mm." };
    if (facts.returnSurface !== "Pass") return { status: "fail", basis: "Return/overhang surface is not recorded as free of climbable projections/indentations." };
    return { status: "pass", basis: "Recorded water-body depth, width, access and intersection conditions satisfy the Queensland composite check." };
  }

  function windowFacts(facts) {
    var h1 = num(facts.externalSill);
    var h2 = num(facts.internalSill);
    if (h1 === null) return { status: "incomplete", basis: "External sill height to pool area is not recorded." };
    if (h1 >= 1800) return { status: "pass", basis: "External sill height is at least 1800mm." };
    if (h2 === null) return { status: "incomplete", basis: "Internal sill height is required when external sill height is below 1800mm." };
    if (h2 >= 1200) return { status: "pass", basis: "Internal sill height is at least 1200mm." };

    var method = facts.method;
    var tools = facts.tools === "Pass";
    var screen = facts.screen === "Pass";
    var strength = facts.strength === "Pass";
    var maxOpening = num(facts.maxOpening);

    if (h2 > 900 && h2 < 1200 && method === "Secure flyscreen") {
      return tools && screen
        ? { status: "pass", basis: "Internal sill is 901-1199mm with securely fixed flyscreen requiring tools for removal." }
        : { status: "fail", basis: "Flyscreen branch requires secure fixing and tool-only removal." };
    }
    if (method === "Bars / mesh") {
      return tools && screen && strength
        ? { status: "pass", basis: "Bars/mesh branch has secure fixing, tool-only removal and strength/rigidity recorded compliant." }
        : { status: "fail", basis: "Bars/mesh branch is missing a required secure-fixing/tool/strength condition." };
    }
    if (method === "Restricted opening") {
      return tools && strength && maxOpening !== null && maxOpening <= 100
        ? { status: "pass", basis: "Restricted-opening branch is fixed with tools required, opening <=100mm and strength/rigidity compliant." }
        : { status: "fail", basis: "Restricted-opening branch requires maximum 100mm opening, tool-only removal and compliant strength/rigidity." };
    }
    return { status: "incomplete", basis: "Select the child-resistant window method that is being relied upon." };
  }

  function retainingFacts(facts) {
    var relation = facts.relativeLevel;
    var height = num(facts.height);
    var slope = num(facts.slope);
    var direction = facts.slopeDirection;
    if (!relation || height === null || slope === null || !direction) return { status: "incomplete", basis: "Retaining-wall relative level, height, slope direction and slope angle are required." };

    if (relation === "Above pool level") {
      if (height < 1800) return { status: "fail", basis: "Retaining wall above pool level is below 1800mm effective height." };
      if (direction === "Away from pool" && slope > 15) return { status: "fail", basis: "Retaining wall above pool level slopes away from the pool by more than 15 degrees." };
      if (facts.noFootholds !== "Pass") return { status: "fail", basis: "Top 900mm/NCZ handhold-footing condition is not recorded as compliant." };
      return { status: "pass", basis: "Above-pool retaining wall height, slope and climbability conditions are recorded compliant." };
    }

    if (relation === "Below pool level") {
      if (direction === "Toward pool" && slope > 15) return { status: "fail", basis: "Retaining wall below pool level slopes toward the pool by more than 15 degrees." };
      if (!(height >= 1800 || facts.faceBarrier === "Pass")) {
        return { status: "fail", basis: "Below-pool wall needs 1800mm effective height including NCZ or an otherwise compliant exposed-face barrier arrangement." };
      }
      if (facts.intersection === "Yes") {
        var ret = num(facts.returnOverhang);
        if (ret === null || ret < 900 || facts.returnSurface !== "Pass") {
          return { status: "fail", basis: "Fence intersection requires a compliant 900mm return/overhang with non-climbable surface." };
        }
      }
      return { status: "pass", basis: "Below-pool retaining wall and any recorded fence intersection satisfy the composite check." };
    }
    return { status: "incomplete", basis: "Select whether the retaining wall is above or below pool level for automated assessment." };
  }

  function balconyFacts(facts) {
    var drop = num(facts.drop);
    var proximity = num(facts.proximity);
    if (drop === null || proximity === null) return { status: "incomplete", basis: "Balcony drop and distance to barrier top are required." };
    var needsProtection = drop < 1800 || proximity <= 900;
    if (!needsProtection) return { status: "pass", basis: "Recorded balcony geometry does not trigger the <1800mm drop or <=900mm proximity condition." };
    if (facts.method === "Compliant barrier to balcony") {
      return facts.balustrade === "Pass"
        ? { status: "pass", basis: "Balcony protection is provided by a compliant barrier/balustrade." }
        : { status: "fail", basis: "Balcony barrier/balustrade method is selected but not recorded as compliant." };
    }
    if (facts.method === "NCZ arrangement") {
      return facts.ncz === "Pass"
        ? { status: "pass", basis: "Balcony protection is provided by the applicable NCZ arrangement." }
        : { status: "fail", basis: "NCZ method is selected but the balcony NCZ is not recorded as compliant." };
    }
    return { status: "fail", basis: "Measured balcony geometry requires a compliant barrier or NCZ protection method." };
  }

  function customEvaluate(el) {
    if (!el || !el.name) return null;
    var card = el.closest ? el.closest(".fence-card") : null;

    if (el.name === "fenceHeight" && card && card.matches('[data-section="fence"]')) {
      var height = num(el.value);
      if (height === null) return null;
      if (height < 1200) {
        return decisionResult(el, "fail", RULES.fenceHeight, {
          value: height,
          threshold: 1200,
          decisionBasis: "No recorded fence-construction branch permits an effective height below 1200mm.",
          issue: "The recorded effective height is " + height + "mm, below the minimum 1200mm base requirement."
        });
      }
      var needed = fenceRequiredHeightFacts({
        type: value(card, "fenceType"),
        aperture: value(card, "fenceApertureSize")
      });
      if (needed.status === "incomplete") return null;
      return decisionResult(el, height >= needed.threshold ? "pass" : "fail", RULES.fenceHeight, {
        value: height,
        threshold: needed.threshold,
        decisionBasis: needed.basis,
        issue: "The recorded effective height is " + height + "mm; this recorded fence construction requires at least " + needed.threshold + "mm."
      });
    }

    if (el.name === "fenceApertureSize" && card && card.matches('[data-section="fence"]')) {
      var type = value(card, "fenceType").toLowerCase();
      if (!/mesh|chainwire|perforat/.test(type)) return decisionResult(el, "na", RULES.meshAperture, { decisionBasis: "Mesh/perforated rule is not applicable to the recorded fence type." });
      var aperture = num(el.value);
      if (aperture === null) return null;
      var top = value(card, "fenceMeshTopStrainer");
      var bottom = value(card, "fenceMeshBottomStrainer");
      if (aperture > 100) {
        return decisionResult(el, "fail", RULES.meshAperture, {
          value: aperture,
          threshold: 100,
          decisionBasis: "Mesh/perforated aperture greater than 100mm is not permitted.",
          issue: "The recorded mesh/perforated aperture is greater than 100mm."
        });
      }
      if (!top || !bottom) return null;
      var pass = top === "Pass" && bottom === "Pass";
      return decisionResult(el, pass ? "pass" : "fail", RULES.meshAperture, {
        value: aperture,
        threshold: 100,
        decisionBasis: pass ? "Aperture <=100mm and top/bottom strainer support recorded compliant." : "Mesh/perforated barrier requires compliant top and bottom strainer wire/rail support.",
        issue: "The aperture is within 100mm, but required top/bottom strainer support is not recorded as compliant."
      });
    }

    if (el.name === "fenceNCZClear" && card && card.matches('[data-section="fence"]')) {
      var arrangement = value(card, "fenceHighBarrierArrangement");
      if (arrangement && arrangement !== "None") {
        var arrangementCompliant = value(card, "fenceHighBarrierArrangementCompliant");
        var highType = value(card, "fenceType").toLowerCase();
        var highHeight = num(value(card, "fenceHeight"));
        var meshConstruction = /mesh|chainwire|perforat/.test(highType);
        var heightQualifies =
          (arrangement === "2400mm or more qualifying fence" && highHeight !== null && highHeight >= 2400) ||
          (arrangement === "1800mm or more with compliant cranked top" && highHeight !== null && highHeight >= 1800);
        if (meshConstruction && heightQualifies && !arrangementCompliant) return null;
        var highPass = meshConstruction && heightQualifies && arrangementCompliant === "Pass";
        return decisionResult(el, highPass ? "na" : "fail", RULES.highBarrier, {
          decisionBasis: highPass
            ? "Qualifying mesh/perforated construction, required recorded height and compliant high-barrier/cranked-top arrangement are all present."
            : "The selected NCZ exception requires qualifying mesh/perforated construction, the applicable minimum height and a compliant recorded arrangement."
        });
      }
    }

    if (el.name === "boundaryFenceHeight" && card && card.classList.contains("boundary-card")) {
      var bd = boundaryFacts({
        height: el.value,
        nczSide: value(card, "boundaryNczSide"),
        clearArea: value(card, "boundaryAdditionalClearAreaMaintained")
      });
      if (bd.status === "incomplete") return null;
      return decisionResult(el, bd.status, RULES.boundary, { value: num(el.value), decisionBasis: bd.basis });
    }

    if (el.name === "nczDistance" && card && card.classList.contains("climbability-card")) {
      var distance = num(el.value);
      if (distance === null) return null;
      if (distance >= 900) return decisionResult(el, "pass", RULES.nczObject, { value: distance, threshold: 900, decisionBasis: "Object is recorded at least 900mm from the barrier." });
      var climbable = value(card, "nczObjectClimbable");
      var upper = value(card, "nczObjectInUpperQuadrant");
      var accessible = value(card, "nczYoungChildCanAccess");
      if (climbable === "No") return decisionResult(el, "pass", RULES.nczObject, { value: distance, threshold: 900, decisionBasis: "Object is within 900mm but recorded as non-climbable." });
      if (climbable === "Yes" && upper === "Yes" && accessible === "No") {
        return decisionResult(el, "pass", RULES.nczObject, { value: distance, threshold: 900, decisionBasis: "Climbable object is recorded in the upper 900mm quadrant and not reasonably accessible to a young child." });
      }
      if (!climbable || climbable === "Uncertain" || !upper || !accessible || accessible === "Uncertain") return null;
      return decisionResult(el, "fail", RULES.nczObject, { value: distance, threshold: 900, decisionBasis: "Object is within 900mm and does not satisfy the recorded non-climbable/upper-quadrant accessibility exception." });
    }

    if (el.name === "waterBarrierDepth" && card && card.classList.contains("water-barrier-card")) {
      var depth = num(el.value);
      if (depth === null) return null;
      return decisionResult(el, depth > 300 ? "pass" : "fail", RULES.waterDepth, {
        value: depth,
        threshold: ">300",
        decisionBasis: depth > 300 ? "Recorded depth is more than 300mm." : "Queensland modification requires the relevant water depth to be continuously more than 300mm."
      });
    }

    if (el.name === "waterBarrierCompliant" && card && card.classList.contains("water-barrier-card")) {
      var wf = waterFacts({
        depth: value(card, "waterBarrierDepth"),
        width: value(card, "waterBarrierWidth"),
        accessBlocked: value(card, "waterBarrierAccessBlocked"),
        returnOverhang: value(card, "waterBarrierReturnOverhang"),
        returnSurface: value(card, "waterBarrierReturnSurfaceCompliant")
      });
      if (wf.status === "incomplete") return null;
      return decisionResult(el, wf.status, RULES.waterComposite, { decisionBasis: wf.basis });
    }

    if (el.name === "barrierDoorCompliant" && card && card.classList.contains("barrier-door-card")) {
      var env = poolEnvironment();
      var doorType = value(card, "barrierDoorType");
      if (!env || !doorType) return null;
      if (env === "Outdoor" && /door/i.test(doorType)) {
        var authorityApplies = value(card, "barrierDoorAuthorityApplies") === "Yes" && confirmedAuthority();
        return decisionResult(el, authorityApplies ? "pass" : "fail", RULES.outdoorDoor, {
          decisionBasis: authorityApplies ? "A confirmed current special authority is recorded as applying to this building-door arrangement." : "Outdoor pool + building door direct-access arrangement without confirmed applicable authority."
        });
      }
      if (env === "Indoor" && /door/i.test(doorType)) {
        var latchHeight = num(value(card, "barrierDoorLatchReleaseHeight"));
        var doorFacts = [
          value(card, "barrierDoorSelfClosing"),
          value(card, "barrierDoorSelfLatching"),
          value(card, "barrierDoorOpensAway"),
          value(card, "barrierDoorNoFootholds"),
          value(card, "barrierDoorConstructionCompliant"),
          value(card, "barrierDoorStrengthCompliant")
        ];
        if (latchHeight === null || doorFacts.some(function (fact) { return !fact; }) ||
            (doorType === "Garage door" && !value(card, "barrierDoorGarageFailSafe"))) return null;
        var passDoor = doorType !== "Pet door" &&
          value(card, "barrierDoorSelfClosing") === "Pass" &&
          value(card, "barrierDoorSelfLatching") === "Pass" &&
          value(card, "barrierDoorOpensAway") === "Pass" &&
          latchHeight >= 1500 &&
          value(card, "barrierDoorNoFootholds") === "Pass" &&
          value(card, "barrierDoorConstructionCompliant") === "Pass" &&
          value(card, "barrierDoorStrengthCompliant") === "Pass" &&
          (doorType !== "Garage door" || value(card, "barrierDoorGarageFailSafe") === "Pass");
        return decisionResult(el, passDoor ? "pass" : "fail", RULES.indoorDoor, {
          decisionBasis: passDoor ? "Indoor doorset closing, latching, swing, latch height and foothold conditions are recorded compliant." : "One or more required indoor child-resistant doorset conditions are not satisfied."
        });
      }
    }

    if (el.name === "barrierWindowCompliant" && card && card.classList.contains("barrier-window-card")) {
      var w = windowFacts({
        externalSill: value(card, "barrierWindowExternalSillHeight"),
        internalSill: value(card, "barrierWindowInternalSillHeight"),
        method: value(card, "barrierWindowMethod"),
        maxOpening: value(card, "barrierWindowMaxOpening"),
        tools: value(card, "barrierWindowFixingsRequireTools"),
        screen: value(card, "barrierWindowScreenBarsMeshFixed"),
        strength: value(card, "barrierWindowStrengthCompliant")
      });
      if (w.status === "incomplete") return null;
      return decisionResult(el, w.status, RULES.window, { decisionBasis: w.basis });
    }

    if (el.name === "retainingWallCompliant" && card && card.classList.contains("retaining-wall-card")) {
      if (value(card, "retainingWallType") !== "Retaining wall") return null;
      var rw = retainingFacts({
        relativeLevel: value(card, "retainingWallRelativeLevel"),
        height: value(card, "retainingWallHeight"),
        slopeDirection: value(card, "retainingWallSlopeDirection"),
        slope: value(card, "retainingWallSlopeDegrees"),
        noFootholds: value(card, "retainingWallNoFootholds"),
        faceBarrier: value(card, "retainingWallFaceBarrierCompliant"),
        intersection: value(card, "retainingWallFenceIntersection"),
        returnOverhang: value(card, "retainingWallReturnOverhang"),
        returnSurface: value(card, "retainingWallReturnSurfaceCompliant")
      });
      if (rw.status === "incomplete") return null;
      return decisionResult(el, rw.status, RULES.retainingWall, { decisionBasis: rw.basis });
    }

    if (el.name === "balconyBarrierCompliant" && card && card.classList.contains("balcony-card")) {
      var bal = balconyFacts({
        drop: value(card, "balconyDropHeight"),
        proximity: value(card, "balconyDistanceToBarrierTop"),
        method: value(card, "balconyProtectionMethod"),
        balustrade: value(card, "balconyBalustradeCompliant"),
        ncz: value(card, "balconyNczCompliant")
      });
      if (bal.status === "incomplete") return null;
      return decisionResult(el, bal.status, RULES.balcony, { decisionBasis: bal.basis });
    }

    if (el.name === "gateType" && card && card.classList.contains("gate-card")) {
      var gateType = clean(el.value);
      if (gateType === "Chameleon gate" && poolEnvironment() === "Outdoor") {
        return decisionResult(el, "fail", RULES.chameleon, { decisionBasis: "Outdoor pool with chameleon-gate arrangement." });
      }
      if (gateType === "Double leaf gate") {
        var fixed = value(card, "gateInactiveLeafPermanentlyFixed");
        var each = value(card, "gateEachLeafSelfClosingLatching");
        if (!fixed || !each) return null;
        return decisionResult(el, fixed === "Pass" && each === "Pass" ? "pass" : "fail", RULES.doubleLeaf, {
          decisionBasis: "Double-leaf gate assessment uses permanent-fixing and self-closing/self-latching evidence."
        });
      }
    }

    if (el.name === "designatedPoolAccessPointCompliant" && card && card.classList.contains("special-pool-feature-card")) {
      var feature = value(card, "specialPoolFeatureType");
      if (feature !== "Above-ground pool" && feature !== "Inflatable pool") return decisionResult(el, "na", RULES.aboveGroundAccess, { decisionBasis: "Designated above-ground access-point rule is not applicable." });
      if (!el.value) return null;
      return decisionResult(el, el.value === "Pass" ? "pass" : "fail", RULES.aboveGroundAccess, {
        decisionBasis: "Above-ground/inflatable pool requires a designated access point enclosed by a compliant barrier and gate."
      });
    }

    if (el.name === "decommissioningFinalApprovalConfirmed" && card && card.classList.contains("decommissioned-pool-card")) {
      if (value(card, "convertedPoolUse") !== "Yes") return null;
      if (!el.value || el.value === "N/A") return null;
      return decisionResult(el, el.value === "Yes" ? "pass" : "fail", RULES.decommissioning, {
        decisionBasis: "Conversion to fishpond/other use requires confirmation of the relevant final approval before treating the former pool as no longer regulated."
      });
    }

    if (el.name === "temporaryFenceApprovalExpiry" && card && card.classList.contains("temporary-fence-card")) {
      var inspectionDate = value(document, "inspectionDate");
      var expiry = clean(el.value);
      if (!inspectionDate || !expiry) return null;
      var expired = expiry < inspectionDate;
      return decisionResult(el, expired ? "fail" : "pass", RULES.temporaryExpired, {
        decisionBasis: expired ? "Approval expiry precedes the recorded inspection date." : "Recorded temporary-fencing approval is current on the inspection date."
      });
    }

    if (el.name === "buildingWorkAffectingBarrier" && card && card.classList.contains("temporary-fence-card")) {
      if (!el.value) return null;
      if (el.value === "N/A") return decisionResult(el, "na", RULES.buildingWork, { decisionBasis: "Building-work barrier check recorded not applicable." });
      return decisionResult(el, el.value === "Pass" ? "pass" : "fail", RULES.buildingWork, {
        decisionBasis: "Field is stated positively: Pass means building work does not compromise the barrier."
      });
    }

    if (el.name === "certificateReadyToIssue") {
      if (!el.value || el.value === "N/A") return el.value === "N/A" ? decisionResult(el, "na", RULES.certificateReady, {}) : null;
      if (el.value === "No" && value(document, "overallInspectionResult") === "Pending") return null;
      return decisionResult(el, el.value === "Yes" ? "pass" : "fail", RULES.certificateReady, {
        decisionBasis: "Certificate readiness is recorded as Yes/No after the overall inspection outcome is determined."
      });
    }

    if (el.name === "ownerAdvisedActions") {
      if (!el.value || el.value === "N/A") return el.value === "N/A" ? decisionResult(el, "na", RULES.ownerAdvice, {}) : null;
      var actionsRequired = value(document, "overallInspectionResult") === "Fail" ||
        value(document, "nonconformityNoticeRequired") === "Yes" ||
        value(document, "reinspectionRequired") === "Yes";
      if (!actionsRequired && el.value === "No") return decisionResult(el, "na", RULES.ownerAdvice, {
        decisionBasis: "No required rectification/reinspection action is currently recorded."
      });
      return decisionResult(el, el.value === "Yes" ? "pass" : "fail", RULES.ownerAdvice, {
        decisionBasis: "Owner advice is required because rectification, notice or reinspection action is recorded."
      });
    }

    return null;
  }

  function manualReviews() {
    var reviews = [];
    function add(code, item, reason) {
      reviews.push({ code: code, item: item, reason: reason });
    }

    document.querySelectorAll('.fence-card[data-section="fence"]').forEach(function (card, index) {
      var type = value(card, "fenceType").toLowerCase();
      if (/mesh|chainwire|perforat/.test(type)) {
        if (num(value(card, "fenceApertureSize")) === null) add("mesh-aperture-missing", "Fence Section " + (index + 1), "Mesh/perforated fence aperture must be recorded for the construction-specific height decision.");
        if (!value(card, "fenceMeshTopStrainer") || !value(card, "fenceMeshBottomStrainer")) add("mesh-strainer-evidence-missing", "Fence Section " + (index + 1), "Top and bottom strainer wire/rail evidence is incomplete.");
      }
      if (value(card, "fenceStrengthRigid") === "Pass" && !value(card, "fenceStrengthAssessmentMethod")) {
        add("strength-method-missing", "Fence Section " + (index + 1), "Strength/rigidity is marked Pass but the assessment method has not been recorded.");
      }
    });

    document.querySelectorAll('.fence-card[data-section="fence"]').forEach(function (card, index) {
      var arrangement = value(card, "fenceHighBarrierArrangement");
      if (!arrangement || arrangement === "None") return;
      var type = value(card, "fenceType").toLowerCase();
      var height = num(value(card, "fenceHeight"));
      var materialOk = /mesh|chainwire|perforat/.test(type);
      var heightOk =
        (arrangement === "2400mm or more qualifying fence" && height !== null && height >= 2400) ||
        (arrangement === "1800mm or more with compliant cranked top" && height !== null && height >= 1800);
      if (!materialOk || !heightOk) {
        add("high-barrier-exception-inapplicable", "Fence Section " + (index + 1), "The NCZ/clear-area exception has been selected but the recorded mesh/perforated construction and/or required effective height does not support that exception.");
      } else if (!value(card, "fenceHighBarrierArrangementCompliant")) {
        add("high-barrier-exception-evidence-incomplete", "Fence Section " + (index + 1), "The qualifying high-barrier/cranked-top path is selected but its compliance assessment has not been completed.");
      }
    });

    document.querySelectorAll(".boundary-card").forEach(function (card, index) {
      var h = num(value(card, "boundaryFenceHeight"));
      if (h !== null && h >= 1200 && h < 1800 && (!value(card, "boundaryNczSide") || !value(card, "boundaryAdditionalClearAreaMaintained"))) {
        add("boundary-conditional-incomplete", "Boundary Section " + (index + 1), "A 1200-1799mm boundary fence needs outside-NCZ and additional-clear-area facts before the engine can decide compliance.");
      }
    });

    document.querySelectorAll(".barrier-door-card").forEach(function (card, index) {
      if (!poolEnvironment()) add("pool-environment-missing", "Door / Building Access " + (index + 1), "Record whether the pool is indoor or outdoor before relying on building-access logic.");
    });

    document.querySelectorAll(".gate-card").forEach(function (card, index) {
      if (value(card, "gateType") === "Double leaf gate" &&
          (!value(card, "gateInactiveLeafPermanentlyFixed") || !value(card, "gateEachLeafSelfClosingLatching"))) {
        add("double-leaf-evidence-incomplete", "Gate " + (index + 1), "Double-leaf gate requires the permanent-fixing/central-fixture and operable-leaf self-closing/self-latching evidence.");
      }
      var latch = num(value(card, "gateLatchHeight"));
      if (latch !== null && latch < 1500) {
        var evidence = [
          value(card, "gateLatchReleaseSide"),
          value(card, "gateHighestLowerHorizontalMemberHeight"),
          value(card, "gateLatchBelowGateTop"),
          value(card, "gateShieldMaxOpening"),
          value(card, "gateShieldRadius")
        ].filter(Boolean);
        if (evidence.length < 3) add("lower-latch-evidence-incomplete", "Gate " + (index + 1), "Latch is below 1500mm; retain enough shielding/location geometry to substantiate the permitted lower-latch arrangement.");
      }
    });

    document.querySelectorAll(".water-barrier-card").forEach(function (card, index) {
      var wf = waterFacts({
        depth: value(card, "waterBarrierDepth"),
        width: value(card, "waterBarrierWidth"),
        accessBlocked: value(card, "waterBarrierAccessBlocked"),
        returnOverhang: value(card, "waterBarrierReturnOverhang"),
        returnSurface: value(card, "waterBarrierReturnSurfaceCompliant")
      });
      if (value(card, "waterBarrierCompliant") === "Pass" && wf.status === "incomplete") {
        add("water-composite-incomplete", "Permanent Body of Water " + (index + 1), "Water barrier is marked Pass but the required depth, width, access or return/overhang facts are incomplete.");
      }
    });

    document.querySelectorAll(".barrier-window-card").forEach(function (card, index) {
      var w = windowFacts({
        externalSill: value(card, "barrierWindowExternalSillHeight"),
        internalSill: value(card, "barrierWindowInternalSillHeight"),
        method: value(card, "barrierWindowMethod"),
        maxOpening: value(card, "barrierWindowMaxOpening"),
        tools: value(card, "barrierWindowFixingsRequireTools"),
        screen: value(card, "barrierWindowScreenBarsMeshFixed"),
        strength: value(card, "barrierWindowStrengthCompliant")
      });
      if (value(card, "barrierWindowCompliant") === "Pass" && w.status === "incomplete") {
        add("window-composite-incomplete", "Window Check " + (index + 1), "Window is marked Pass but the sill geometry or child-resistant method evidence is incomplete.");
      }
    });

    document.querySelectorAll(".retaining-wall-card").forEach(function (card, index) {
      if (value(card, "retainingWallType") !== "Retaining wall") return;
      var rw = retainingFacts({
        relativeLevel: value(card, "retainingWallRelativeLevel"),
        height: value(card, "retainingWallHeight"),
        slopeDirection: value(card, "retainingWallSlopeDirection"),
        slope: value(card, "retainingWallSlopeDegrees"),
        noFootholds: value(card, "retainingWallNoFootholds"),
        faceBarrier: value(card, "retainingWallFaceBarrierCompliant"),
        intersection: value(card, "retainingWallFenceIntersection"),
        returnOverhang: value(card, "retainingWallReturnOverhang"),
        returnSurface: value(card, "retainingWallReturnSurfaceCompliant")
      });
      if (value(card, "retainingWallCompliant") === "Pass" && rw.status === "incomplete") {
        add("retaining-composite-incomplete", "Retaining Wall " + (index + 1), "Retaining wall is marked Pass but the branch-specific height/slope/intersection evidence is incomplete.");
      }
    });

    document.querySelectorAll(".balcony-card").forEach(function (card, index) {
      var bal = balconyFacts({
        drop: value(card, "balconyDropHeight"),
        proximity: value(card, "balconyDistanceToBarrierTop"),
        method: value(card, "balconyProtectionMethod"),
        balustrade: value(card, "balconyBalustradeCompliant"),
        ncz: value(card, "balconyNczCompliant")
      });
      if (value(card, "balconyBarrierCompliant") === "Pass" && bal.status === "incomplete") {
        add("balcony-composite-incomplete", "Balcony Check " + (index + 1), "Balcony is marked Pass but the measured drop/proximity or protection-method evidence is incomplete.");
      }
    });

    document.querySelectorAll(".special-pool-feature-card").forEach(function (card, index) {
      var feature = value(card, "specialPoolFeatureType");
      if ((feature === "Above-ground pool" || feature === "Inflatable pool") &&
          !value(card, "designatedPoolAccessPointCompliant")) {
        add("aboveground-access-incomplete", "Special Pool Feature " + (index + 1), "Record whether the designated pool access point is enclosed by a compliant barrier and gate.");
      }
    });

    document.querySelectorAll(".decommissioned-pool-card").forEach(function (card, index) {
      if (value(card, "convertedPoolUse") === "Yes" && !/^(Yes|No)$/.test(value(card, "decommissioningFinalApprovalConfirmed"))) {
        add("decommissioning-approval-incomplete", "Decommissioned / Converted Pool " + (index + 1), "A conversion is recorded but final approval confirming the structure is no longer a swimming pool has not been decided.");
      }
    });

    document.querySelectorAll(".temporary-fence-card").forEach(function (card, index) {
      if (value(card, "temporaryFencingPresent") === "Pass" &&
          (!value(card, "temporaryFenceApprovalDate") || !value(card, "temporaryFenceApprovalReference"))) {
        add("temporary-fence-authority-incomplete", "Temporary Fencing " + (index + 1), "Temporary fencing is being relied upon but approval/inspection date or documentary reference is incomplete.");
      }
    });

    var authorityType = value(document, "specialAuthorityType");
    if (authorityType && authorityType !== "None / not applicable") {
      if (value(document, "specialAuthorityStatus") !== "Confirmed current" || !value(document, "specialAuthorityReference") || !value(document, "specialAuthorityScope")) {
        add("special-authority-incomplete", "Special authority", "A recorded exemption/performance solution/variation needs current status, reference and scope before it should affect an automated decision.");
      }
      if (authorityType === "Performance solution" &&
          (value(document, "specialAuthorityRegisteredOnPoolRegister") !== "Yes" || !value(document, "specialAuthorityForm17Reference"))) {
        add("performance-solution-registration-incomplete", "Performance solution", "Record confirmation that the performance solution is registered on the regulated pools register and retain the Form 17/final-inspection reference.");
      }
    }
    return reviews;
  }

  function categoryForFinding(finding) {
    var id = clean(finding && finding.id);
    var fieldName = clean(finding && finding.ruleField || finding && finding.field).toLowerCase();
    var item = clean(finding && finding.item).toLowerCase();
    if (/referral|electrical|asbestos|bonding|fire/.test(id + " " + fieldName + " " + item)) return "referral";
    if (/overall-result|certificate-ready|nonconformitynotice|reinspection|required actions|register-update/.test((id + " " + fieldName + " " + item).toLowerCase())) return "administrative";
    return "barrier";
  }

  function compactDecision(result, el) {
    return {
      ruleId: result.rule && result.rule.id || "",
      status: result.status || "",
      category: result.category || result.rule && result.rule.category || categoryForFinding({ id: result.rule && result.rule.id, field: el && el.name, item: result.item }),
      item: result.item || "",
      field: el && el.name || "",
      label: result.label || "",
      value: result.value === undefined ? "" : result.value,
      threshold: result.threshold === undefined ? "" : result.threshold,
      decisionBasis: result.decisionBasis || "",
      overriddenBy: result.overriddenBy || "",
      sourceRef: result.rule && result.rule.sourceRef || ""
    };
  }

  function buildDecisionAudit() {
    var decisions = [];
    var seen = {};
    Array.prototype.slice.call(document.querySelectorAll("[data-save][name]")).forEach(function (el) {
      if (typeof window.evaluateComplianceForElement !== "function") return;
      var result = window.evaluateComplianceForElement(el);
      if (!result || !result.status) return;
      var compact = compactDecision(result, el);
      var key = [compact.ruleId, compact.item, compact.field, String(compact.value)].join("|");
      if (seen[key]) return;
      seen[key] = true;
      decisions.push(compact);
    });
    return decisions;
  }

  function specialAuthoritySnapshot() {
    return {
      type: value(document, "specialAuthorityType"),
      status: value(document, "specialAuthorityStatus"),
      reference: value(document, "specialAuthorityReference"),
      authority: value(document, "specialAuthorityAuthority"),
      scope: value(document, "specialAuthorityScope"),
      conditions: value(document, "specialAuthorityConditions"),
      registeredOnPoolRegister: value(document, "specialAuthorityRegisteredOnPoolRegister"),
      form17Reference: value(document, "specialAuthorityForm17Reference")
    };
  }

  function parseDateOnly(text) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(text));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0) : null;
  }

  function formatDateOnly(date) {
    if (!date || isNaN(date.getTime())) return "";
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function addBusinessDays(text, count) {
    var date = parseDateOnly(text);
    if (!date) return "";
    var remaining = count;
    while (remaining > 0) {
      date.setDate(date.getDate() + 1);
      var day = date.getDay();
      if (day !== 0 && day !== 6) remaining -= 1;
    }
    return formatDateOnly(date);
  }

  function addCalendarMonths(text, count) {
    var date = parseDateOnly(text);
    if (!date) return "";
    var originalDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + count);
    var last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(originalDay, last));
    return formatDateOnly(date);
  }

  function workflowDeadlines() {
    var inspection = value(document, "inspectionDate");
    var notice = value(document, "nonconformityNoticeIssuedDate");
    var request = value(document, "reinspectionRequestedDate");
    var agreedLater = value(document, "reinspectionAgreedLaterDate");
    var periodEnd = notice ? addCalendarMonths(notice, 3) : "";
    return {
      certificateOrNoticeGeneralDue: inspection ? addBusinessDays(inspection, 2) : "",
      minorRepairAgreementDue: value(document, "minorRepairAgreementDueDate") || (value(document, "minorRepairAgreement") === "Yes" && inspection ? addBusinessDays(inspection, 20) : ""),
      reinspectionPeriodEnd: periodEnd,
      localGovernmentNotificationDue: periodEnd ? addBusinessDays(periodEnd, 5) : "",
      reinspectionServiceDue: value(document, "reinspectionDueDate") || (request ? (agreedLater || addBusinessDays(request, 5)) : ""),
      calculationNote: "Guide dates exclude weekends but do not automatically account for Queensland public holidays. Verify statutory business-day dates before acting."
    };
  }

  function workflowAlerts(deadlines) {
    var today = formatDateOnly(new Date());
    var alerts = [];
    function overdue(code, due, completed, message) {
      if (due && due < today && !completed) alerts.push({ code: code, due: due, message: message });
    }
    if (value(document, "certificateReadyToIssue") === "Yes") {
      overdue("certificate-due", deadlines.certificateOrNoticeGeneralDue, value(document, "certificateIssuedDate"), "Potential deadline check: the certificate issue date is not recorded and the guide two-business-day date has passed. Verify public holidays and the applicable statutory pathway.");
    }
    if (value(document, "nonconformityNoticeRequired") === "Yes" && value(document, "minorRepairAgreement") !== "Yes") {
      overdue("nonconformity-notice-due", deadlines.certificateOrNoticeGeneralDue, value(document, "nonconformityNoticeIssuedDate"), "Potential deadline check: the nonconformity notice issue date is not recorded and the guide two-business-day date has passed. Verify public holidays and any applicable exception pathway.");
    }
    if (value(document, "minorRepairAgreement") === "Yes") {
      overdue("minor-repair-due", deadlines.minorRepairAgreementDue, value(document, "reinspectionCompletedDate"), "Potential deadline check: the recorded minor-repair agreement has passed its recorded/guide due date without a completed inspection outcome date.");
    }
    if (value(document, "reinspectionRequestedDate")) {
      overdue("reinspection-service-due", deadlines.reinspectionServiceDue, value(document, "reinspectionCompletedDate"), "Potential deadline check: the requested reinspection is past its recorded/guide service date and no later agreed/completed date is recorded.");
    }
    if (value(document, "nonconformityNoticeIssuedDate") && !value(document, "reinspectionRequestedDate")) {
      overdue("local-government-notification-due", deadlines.localGovernmentNotificationDue, value(document, "localGovernmentNotifiedDate"), "Potential deadline check: no reinspection request is recorded and the guide local-government notification date has passed. Verify the business-day calculation before acting.");
    }
    return alerts;
  }

  function workflowSnapshot() {
    var names = [
      "overallInspectionResult", "certificateReadyToIssue", "certificateIssuedDate",
      "nonconformityNoticeRequired", "nonconformityNoticeIssuedDate", "nonconformityNoticeReference",
      "minorRepairAgreement", "minorRepairAgreementDueDate",
      "reinspectionRequired", "reinspectionDueDate", "reinspectionRequestedDate", "reinspectionAgreedLaterDate", "reinspectionCompletedDate",
      "localGovernmentNotifiedDate", "ownerAdvisedActions"
    ];
    var result = {};
    names.forEach(function (name) { result[name] = value(document, name); });
    result.derivedDeadlines = workflowDeadlines();
    result.alerts = workflowAlerts(result.derivedDeadlines);
    return result;
  }

  function buildTimeline(data) {
    var previous = null;
    try {
      if (data && data.id && typeof window.getInspectionById === "function") previous = window.getInspectionById(data.id);
    } catch (error) {}
    var timeline = previous && Array.isArray(previous.auditTimeline) ? previous.auditTimeline.slice(-180) : [];
    var priorFields = previous && previous.fields || {};
    var currentFields = data && data.fields || {};
    var tracked = [
      "overallInspectionResult", "certificateReadyToIssue", "certificateIssuedDate",
      "nonconformityNoticeRequired", "nonconformityNoticeIssuedDate", "nonconformityNoticeReference",
      "minorRepairAgreement", "minorRepairAgreementDueDate",
      "reinspectionRequired", "reinspectionDueDate", "reinspectionRequestedDate", "reinspectionAgreedLaterDate", "reinspectionCompletedDate",
      "localGovernmentNotifiedDate", "ownerAdvisedActions",
      "specialAuthorityType", "specialAuthorityStatus", "specialAuthorityReference",
      "specialAuthorityRegisteredOnPoolRegister", "specialAuthorityForm17Reference"
    ];
    tracked.forEach(function (name) {
      var before = priorFields[name] === undefined ? "" : priorFields[name];
      var after = currentFields[name] === undefined ? "" : currentFields[name];
      if (String(before) === String(after) || clean(after) === "") return;
      var last = timeline[timeline.length - 1];
      if (last && last.field === name && String(last.to) === String(after)) return;
      timeline.push({
        at: new Date().toISOString(),
        field: name,
        from: before,
        to: after
      });
    });
    return timeline.slice(-200);
  }

  function updateComplianceReviewUi() {
    var manual = manualReviews();
    var workflow = workflowSnapshot();
    var alerts = workflow.alerts || [];
    var manualCount = document.getElementById("summaryManualReviewCount");
    var alertCount = document.getElementById("summaryWorkflowAlertCount");
    var status = document.getElementById("summaryComplianceEngineStatus");
    var list = document.getElementById("summaryComplianceAlerts");

    if (manualCount) manualCount.textContent = String(manual.length);
    if (alertCount) alertCount.textContent = String(alerts.length);
    if (status) {
      if (!manual.length && !alerts.length) {
        status.textContent = "No unresolved conditional-evidence or workflow-date checks are currently flagged by the compliance engine.";
      } else {
        status.textContent = [
          manual.length ? manual.length + " inspector review item" + (manual.length === 1 ? "" : "s") : "",
          alerts.length ? alerts.length + " workflow date check" + (alerts.length === 1 ? "" : "s") : ""
        ].filter(Boolean).join(" • ") + ". These prompts support, but do not replace, the inspector's statutory decision.";
      }
    }

    if (list) {
      list.innerHTML = "";
      manual.slice(0, 8).forEach(function (review) {
        var li = document.createElement("li");
        li.textContent = review.item + ": " + review.reason;
        list.appendChild(li);
      });
      alerts.slice(0, 6).forEach(function (alert) {
        var li = document.createElement("li");
        li.textContent = alert.message + (alert.due ? " Guide/recorded date: " + alert.due + "." : "");
        list.appendChild(li);
      });
      if ((manual.length + alerts.length) > 14) {
        var more = document.createElement("li");
        more.textContent = "Additional review items are retained in the saved compliance-engine audit record.";
        list.appendChild(more);
      }
      if (workflow.derivedDeadlines && workflow.derivedDeadlines.calculationNote && (alerts.length || manual.length)) {
        var note = document.createElement("li");
        note.textContent = workflow.derivedDeadlines.calculationNote;
        list.appendChild(note);
      }
    }
  }

  function refreshDerivedMarkers(target) {
    var card = target && target.closest ? target.closest(".fence-card") : null;
    if (!card || typeof window.applyComplianceMarkerForElement !== "function") return;
    [
      "fenceHeight", "fenceApertureSize", "fenceNCZClear", "boundaryFenceHeight", "nczDistance",
      "waterBarrierDepth", "waterBarrierCompliant", "barrierDoorCompliant", "barrierWindowCompliant",
      "retainingWallCompliant", "balconyBarrierCompliant", "gateType", "designatedPoolAccessPointCompliant",
      "decommissioningFinalApprovalConfirmed", "temporaryFenceApprovalExpiry"
    ].forEach(function (name) {
      var el = field(card, name);
      if (el) window.applyComplianceMarkerForElement(el);
    });
    var summaryPage = document.getElementById("summary");
    if (summaryPage && summaryPage.classList.contains("active-page")) updateComplianceReviewUi();
  }

  var DERIVED_OWNED_FIELDS = {
    fenceHeight: true,
    fenceApertureSize: true,
    boundaryFenceHeight: true,
    nczDistance: true,
    waterBarrierDepth: true
  };

  var baseEvaluate = window.evaluateComplianceForElement;
  if (typeof baseEvaluate === "function") {
    window.evaluateComplianceForElement = function (el) {
      var custom = customEvaluate(el);
      if (custom) return custom;
      if (el && DERIVED_OWNED_FIELDS[el.name]) return null;
      return baseEvaluate.apply(this, arguments);
    };
  }

  var baseCollectFindings = window.collectFindings;
  if (typeof baseCollectFindings === "function") {
    window.collectFindings = function () {
      var findings = baseCollectFindings.apply(this, arguments) || [];
      findings.forEach(function (finding) {
        if (!finding.category) finding.category = categoryForFinding(finding);
        if (!finding.ruleField) finding.ruleField = finding.field || "";
      });
      return findings;
    };
  }

  var baseRefreshSummary = window.refreshSummary;
  if (typeof baseRefreshSummary === "function") {
    window.refreshSummary = function () {
      var result = baseRefreshSummary.apply(this, arguments);
      updateComplianceReviewUi();
      return result;
    };
  }

  var baseGatherInspectionData = window.gatherInspectionData;
  if (typeof baseGatherInspectionData === "function") {
    window.gatherInspectionData = function () {
      var data = baseGatherInspectionData.apply(this, arguments);
      if (!data) return data;
      data.complianceEngine = {
        version: ENGINE_VERSION,
        jurisdiction: "Queensland",
        sourceHierarchy: SOURCE_HIERARCHY.slice(),
        evaluatedAt: new Date().toISOString(),
        poolEnvironment: poolEnvironment(),
        decisions: buildDecisionAudit(),
        manualReview: manualReviews(),
        specialAuthority: specialAuthoritySnapshot(),
        workflow: workflowSnapshot()
      };
      data.auditTimeline = buildTimeline(data);

      var previousInspection = null;
      try {
        if (data.id && typeof window.getInspectionById === "function") previousInspection = window.getInspectionById(data.id);
      } catch (error) {}
      data.clientReportAudit = window.BARRIER_CHECK_CLIENT_REPORT_AUDIT ||
        (previousInspection && previousInspection.clientReportAudit) || null;
      return data;
    };
  }

  document.addEventListener("change", function (event) {
    if (!event.target || !event.target.name) return;
    window.setTimeout(function () { refreshDerivedMarkers(event.target); }, 0);
  });

  document.addEventListener("input", function (event) {
    if (!event.target || event.target.type !== "number") return;
    window.clearTimeout(window.__bcComplianceInputTimer);
    window.__bcComplianceInputTimer = window.setTimeout(function () { refreshDerivedMarkers(event.target); }, 120);
  });

  window.BARRIER_CHECK_COMPLIANCE_ENGINE = {
    version: ENGINE_VERSION,
    sourceHierarchy: SOURCE_HIERARCHY.slice(),
    evaluateFacts: {
      fenceRequiredHeight: fenceRequiredHeightFacts,
      boundary: boundaryFacts,
      waterBarrier: waterFacts,
      window: windowFacts,
      retainingWall: retainingFacts,
      balcony: balconyFacts
    },
    manualReviews: manualReviews,
    buildDecisionAudit: buildDecisionAudit,
    specialAuthoritySnapshot: specialAuthoritySnapshot,
    workflowSnapshot: workflowSnapshot,
    workflowDeadlines: workflowDeadlines,
    updateComplianceReviewUi: updateComplianceReviewUi
  };

  window.setTimeout(updateComplianceReviewUi, 0);
})();
