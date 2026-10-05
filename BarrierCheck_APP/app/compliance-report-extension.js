// Client-facing guidance for failures produced by compliance-engine.js.
// Decision-making remains in the compliance engine; this file only improves explanation/rectification wording.
(function () {
  "use strict";

  var lib = window.BARRIER_CHECK_RECTIFICATION_LIBRARY;
  if (!lib || !lib.rules) return;

  lib.contentVersion = "2026-10-05-compliance-engine1";
  lib.sourceRegister = lib.sourceRegister || {};
  lib.sourceRegister.qldPsi2024 = {
    title: "Guideline for pool safety inspectors",
    effectiveDate: "2024-06-10",
    type: "Queensland chief executive guideline"
  };

  function add(id, data) {
    if (!lib.rules[id]) lib.rules[id] = data;
  }

  add("engine-boundary-height-side", {
    customerTitle: "Boundary fence height / NCZ arrangement needs rectification",
    whyItMatters: "A lower boundary fence is only acceptable when the required non-climbable zone is provided on the correct side. Height cannot be considered by itself.",
    requirementSummary: "A Queensland boundary fence may be below 1800 mm, but not below 1200 mm, only when the NCZ is on the outside of the fence. At 1800 mm or higher, the NCZ may be arranged on the inside or outside subject to the remaining requirements.",
    sources: [
      { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modifications 6–7" },
      { document: "AS 1926.1—2007", clause: "2.3.1 as modified" }
    ],
    possibleRectificationOptions: [
      "Increase or reconstruct the affected boundary barrier so the final height and NCZ arrangement comply.",
      "Where a 1200–1799 mm boundary fence is retained, establish and permanently maintain the required outside NCZ.",
      "Where neighbour-side conditions prevent a reliable outside NCZ, consider a compliant 1800 mm or higher arrangement and reassess the inside/outside NCZ configuration."
    ],
    cautions: ["Reassess effective height, climbable objects, intersections and adjoining barrier sections after the work."]
  });

  add("engine-mesh-aperture-height", {
    customerTitle: "Mesh fence aperture and height combination is not compliant",
    whyItMatters: "Larger mesh openings can make the barrier easier to climb, so the minimum effective height increases with aperture size.",
    requirementSummary: "Mesh/perforated apertures up to 13 mm use the 1200 mm height branch. Apertures over 13 mm and up to 100 mm require at least 1800 mm effective height. Apertures over 100 mm are not permitted.",
    sources: [{ document: "AS 1926.1—2007", clause: "2.3.2" }],
    possibleRectificationOptions: [
      "Replace the affected mesh with a smaller-aperture compliant barrier material.",
      "Increase/reconstruct the barrier to the applicable effective height for the recorded aperture size.",
      "Replace the affected section with another compliant barrier type where modifying the existing mesh is not suitable."
    ]
  });

  add("engine-mesh-strainers", {
    customerTitle: "Mesh fence is missing a required strainer wire / rail",
    whyItMatters: "Top and bottom restraint helps the mesh maintain its intended shape and opening size.",
    requirementSummary: "Mesh fencing requires a strainer wire or rail at both the top and bottom.",
    sources: [{ document: "AS 1926.1—2007", clause: "2.3.2" }],
    possibleRectificationOptions: [
      "Install a suitable permanent top and/or bottom strainer wire or rail.",
      "Replace the mesh barrier section if the existing construction cannot be brought into a compliant configuration."
    ]
  });

  add("engine-ncz-object-assessment", {
    customerTitle: "Climbable feature compromises the non-climbable zone",
    whyItMatters: "A feature that can reasonably be reached and used as a handhold or foothold can allow a young child to gain height beside the barrier.",
    requirementSummary: "The NCZ assessment considers whether a feature is actually climbable and reasonably accessible to a young child, not distance alone.",
    sources: [
      { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modification 8" },
      { document: "Guideline for pool safety inspectors", clause: "NCZ / climbable vegetation" }
    ],
    possibleRectificationOptions: [
      "Remove or permanently relocate the climbable object outside the applicable NCZ.",
      "Modify or shield the feature so it no longer provides an accessible handhold or foothold.",
      "For vegetation, prune/remove the climbable portion while retaining only vegetation that cannot reasonably support or assist a young child."
    ]
  });

  add("engine-outdoor-direct-door", {
    customerTitle: "Direct building access to the outdoor pool area is not permitted",
    whyItMatters: "A normal building door is used frequently and can provide uncontrolled access to the pool area if it is relied upon as the pool barrier.",
    requirementSummary: "Under the ordinary Queensland prescriptive arrangement, an outdoor-pool barrier must not permit direct access from the building. Any special exemption/solution must be verified within its specific scope.",
    sources: [
      { document: "AS 1926.2—2007", clause: "4.2 as modified by QDC MP 3.4" },
      { document: "Guideline for pool safety inspectors", clause: "Child-resistant doors" }
    ],
    possibleRectificationOptions: [
      "Install/reconfigure a compliant barrier and gate between the building access and the pool area.",
      "Remove the direct-access pathway as part of a compliant barrier redesign.",
      "If a lawful property-specific exemption/performance solution is claimed, provide it to the inspector for verification rather than relying on the doorset alone."
    ]
  });

  add("engine-indoor-child-resistant-door", {
    customerTitle: "Indoor-pool child-resistant doorset does not meet the recorded requirements",
    whyItMatters: "The doorset is a primary access-control point to the indoor pool and must reliably return to a closed and latched condition.",
    requirementSummary: "A child-resistant doorset used for indoor-pool access must satisfy the applicable closing, latching, swing and construction requirements.",
    sources: [
      { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modifications 15 and 26" },
      { document: "AS 1926.2—2007", clause: "4.4.1" }
    ],
    possibleRectificationOptions: [
      "Adjust or replace the self-closing/latching hardware so the door operates reliably.",
      "Rehang/reconfigure the doorset so it does not open toward the pool where required.",
      "Provide another compliant barrier arrangement to control access to the indoor pool."
    ]
  });

  add("engine-water-barrier", {
    customerTitle: "Permanent body of water does not satisfy the barrier conditions",
    whyItMatters: "A canal, lake, river, pond or similar water body can only replace a physical barrier where its full geometry and access conditions prevent a young child reaching the pool.",
    requirementSummary: "The water must be continuously more than 300 mm deep, at least 1800 mm wide beside the protected pool edge, prevent access over/under and use the prescribed barrier-intersection return/overhang treatment with non-climbable surfaces.",
    sources: [
      { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modification 17" },
      { document: "AS 1926.1—2007", clause: "2.6.3 as modified" }
    ],
    possibleRectificationOptions: [
      "Provide a compliant physical pool barrier along the affected water-side boundary.",
      "Rectify the deficient width/depth/access condition where a permanent lawful solution is practicable.",
      "Extend/reconfigure the intersecting barrier with the required return/overhang treatment and remove climbable handholds/footholds."
    ]
  });

  add("engine-window-branch", {
    customerTitle: "Window opening / protection arrangement is not compliant",
    whyItMatters: "An openable window in or beside the pool barrier can allow a young child to enter the pool area if the opening or protective screen is not child-resistant.",
    requirementSummary: "The applicable window solution depends on the external sill height, internal sill height and the selected restriction/bars/mesh arrangement.",
    sources: [{ document: "AS 1926.1—2007", clause: "2.7" }],
    possibleRectificationOptions: [
      "Install a secure opening restrictor that limits the opening to the applicable maximum and requires tools for removal where that branch is used.",
      "Install compliant fixed bars or mesh/screening with suitable strength and tool-removable fixings where permitted.",
      "Alter the barrier/window relationship so the window is no longer an access point requiring the deficient arrangement."
    ]
  });

  add("engine-retaining-intersection", {
    customerTitle: "Fence / retaining-wall intersection needs rectification",
    whyItMatters: "An untreated intersection can create a route around the barrier or provide climbable handholds/footholds.",
    requirementSummary: "Where a fence intersects the relevant retaining-wall barrier, the applicable 900 mm return/overhang treatment and non-climbable surface conditions must be provided.",
    sources: [
      { document: "AS 1926.1—2007", clause: "2.6.2" },
      { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modification 16" }
    ],
    possibleRectificationOptions: [
      "Extend the barrier with the applicable 900 mm return/overhang arrangement.",
      "Remove or redesign projections/indentations on the return/overhang that create handholds or footholds.",
      "Provide a different compliant barrier configuration across the affected level change."
    ]
  });

  add("engine-retaining-wall", {
    customerTitle: "Retaining-wall barrier geometry is not compliant",
    whyItMatters: "The wall height and slope determine whether the retaining wall itself can reliably restrict access to the pool.",
    requirementSummary: "Retaining walls above and below pool level use different branches for height, slope, NCZ and any additional fence arrangement.",
    sources: [{ document: "AS 1926.1—2007", clause: "2.6.1–2.6.2" }],
    possibleRectificationOptions: [
      "Increase/reconstruct the retaining-wall barrier to the applicable effective height and slope.",
      "Install a separate compliant pool barrier where the retaining wall cannot satisfy the applicable branch.",
      "Rectify the adjoining fence/NCZ arrangement and reassess the complete level-change condition."
    ]
  });

  add("engine-balcony-geometry", {
    customerTitle: "Balcony / deck arrangement affects the pool barrier",
    whyItMatters: "A low balcony or one close to the top of the pool barrier can create direct or climbable access into the pool area.",
    requirementSummary: "The balcony requirements are triggered by the recorded drop and proximity to the barrier, with additional Queensland NCZ treatment where applicable.",
    sources: [
      { document: "AS 1926.1—2007", clause: "2.9" },
      { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modifications 19–20" }
    ],
    possibleRectificationOptions: [
      "Provide/upgrade a compliant barrier or balustrade to the affected balcony/deck edge.",
      "Reconfigure the pool barrier so the balcony no longer compromises the applicable NCZ.",
      "Modify the access relationship and reassess the measured balcony/barrier distances."
    ]
  });

  add("engine-chameleon-gate", {
    customerTitle: "Chameleon-gate arrangement is not permitted for this outdoor pool",
    whyItMatters: "The arrangement still provides direct access from the building rather than a compliant isolated outdoor-pool barrier.",
    requirementSummary: "Queensland guidance identifies chameleon gates as unacceptable for outdoor pools because they do not cure prohibited direct building access.",
    sources: [{ document: "Guideline for pool safety inspectors", clause: "Chameleon gates" }],
    possibleRectificationOptions: [
      "Remove the chameleon-gate arrangement and provide a compliant freestanding barrier/gate layout that prevents direct building access.",
      "Reconfigure the pool enclosure so the building door opens to an area separated from the pool by a compliant barrier."
    ]
  });

  add("engine-double-leaf-gate", {
    customerTitle: "Double-leaf pool gate arrangement is not compliant",
    whyItMatters: "If either leaf can remain unsecured or does not self-close/self-latch, the opening can provide unsupervised access to the pool area.",
    requirementSummary: "Queensland guidance requires a permanent fixed-leaf/centre arrangement and compliant self-closing/self-latching performance for each operable leaf.",
    sources: [{ document: "Guideline for pool safety inspectors", clause: "Leaf (swing) gates" }],
    possibleRectificationOptions: [
      "Permanently secure the required leaf using an appropriate permanent fixing/fixture rather than a padlock or drop bolt.",
      "Provide a permanent centre post/fixture and ensure each operable leaf self-closes and self-latches.",
      "Replace the double-leaf arrangement with a compliant single-gate configuration."
    ]
  });

  add("engine-lower-latch-arrangement", {
    customerTitle: "Lower gate latch shielding / reach arrangement is not compliant",
    whyItMatters: "A low latch may be reachable by a young child unless the complete shielding and reach geometry prevents operation from the non-pool side.",
    requirementSummary: "Where a latch release is below the usual height, the permitted shielding/opening/hand-hole geometry must be satisfied.",
    sources: [{ document: "AS 1926.1—2007", clause: "2.5.4.3" }],
    possibleRectificationOptions: [
      "Raise the latch release to a compliant position.",
      "Install/reconfigure compliant shielding and close excessive reach-through openings.",
      "Replace the latch/gate arrangement where the required shielding geometry cannot be achieved."
    ]
  });

  add("engine-above-ground-access", {
    customerTitle: "Above-ground pool access point is not correctly enclosed",
    whyItMatters: "A ladder or designated entry point provides direct access to the pool even when the pool wall itself forms part of the barrier.",
    requirementSummary: "Queensland requires a designated access point enclosed by a compliant barrier and gate regardless of whether a permanent ladder is installed.",
    sources: [
      { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modification 21" },
      { document: "AS 1926.1—2007", clause: "2.10" }
    ],
    possibleRectificationOptions: [
      "Enclose the designated access point with a compliant barrier and self-closing/self-latching gate.",
      "Relocate ladder/filter equipment so it does not compromise the NCZ.",
      "Reconfigure the above-ground pool access arrangement and reassess the pool wall, access gate and NCZ as one system."
    ]
  });

  add("engine-building-work-barrier", {
    customerTitle: "Building work is compromising the pool barrier",
    whyItMatters: "Temporary removal, openings or altered sections can leave the pool accessible while work is underway.",
    requirementSummary: "Building work must not leave the pool without the required effective barrier; temporary fencing/controls must follow the applicable approval pathway.",
    sources: [
      { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modifications 3–4" },
      { document: "Guideline for pool safety inspectors", clause: "Temporary fencing" }
    ],
    possibleRectificationOptions: [
      "Install/maintain an approved compliant temporary barrier while the permanent barrier is affected.",
      "Reinstate or complete the permanent pool barrier before access is restored.",
      "Obtain/retain any required certifier or inspector approval for the temporary-fence period."
    ]
  });

  add("engine-ncz-end-extension", {
    customerTitle: "NCZ does not continue far enough past the fence end / intersection",
    whyItMatters: "A child may be able to approach the barrier from beside an interrupted NCZ if the protected zone stops at a corner, fence end or intersection.",
    requirementSummary: "Where the NCZ is provided on the outside, it must continue 900 mm beyond the end of the fence and beyond intersections with another barrier or object, together with the associated additional clear area.",
    sources: [{ document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modification 10" }],
    possibleRectificationOptions: [
      "Extend/reconfigure the relevant NCZ and clear area through the required distance beyond the fence end or intersection.",
      "Remove or relocate the intersecting climbable feature where that provides a compliant permanent arrangement.",
      "Reconfigure the adjoining barrier so the full NCZ relationship can be maintained and reassessed."
    ]
  });

  add("engine-additional-clear-area-width", {
    customerTitle: "Additional clear area beside the outside NCZ is insufficient",
    whyItMatters: "Raised or nearby features in this area can reduce the effective height available above a climbable level even if the fence panel itself is unchanged.",
    requirementSummary: "When the NCZ is on the outside, an additional clear area must be maintained immediately beside it. Queensland inspector guidance describes this as a 300 mm-wide area used to preserve the required effective barrier height.",
    sources: [
      { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modification 9" },
      { document: "Guideline for pool safety inspectors", clause: "Additional clear area" }
    ],
    possibleRectificationOptions: [
      "Remove or relocate raised/climbable objects that encroach on the additional clear area.",
      "Alter the permanent ground/landscape level where appropriate so the required effective height is maintained.",
      "Reconfigure or increase the barrier where the surrounding level cannot be changed, then reassess the NCZ and effective height."
    ]
  });

  add("engine-inside-ncz-intersection", {
    customerTitle: "Intersecting surface is too wide within the inside NCZ",
    whyItMatters: "A wide rail or surface crossing the inside NCZ can create a usable climbing platform next to the barrier.",
    requirementSummary: "For a barrier 1800 mm or higher using an inside NCZ, an intersecting barrier is only permitted where the top rail or surface is no more than 50 mm wide at points within the NCZ.",
    sources: [{ document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modification 11" }],
    possibleRectificationOptions: [
      "Reduce or replace the intersecting rail/surface so its width within the NCZ satisfies the permitted arrangement.",
      "Remove/reconfigure the intersecting feature so it no longer crosses the inside NCZ.",
      "Use another compliant NCZ/barrier arrangement and reassess the complete intersection."
    ]
  });

})();