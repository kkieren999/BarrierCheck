// BarrierCheck client-report causal logic bank.
// This file only affects how already-recorded failures are explained/grouped
// in the client-facing report. It does not change inspection compliance,
// measurements, pass/fail values or certification decisions.
(function () {
  "use strict";

  window.BARRIER_CHECK_REPORT_LOGIC = {
    version: "20261005.1",

    // When the detailed inspection already contains the equivalent failure,
    // omit the duplicated high-level safety/outcome check from the client report.
    duplicateRules: {
      "safety-windowopeningrestricted": ["window-opening-restricted"],
      "safety-screenbarsmeshfixed": ["window-screen-bars-fixed"],
      "safety-fixingsrequiretools": ["window-fixings-tools"],
      "safety-dooraccesscompliant": ["door-compliant"],
      "safety-directbuildingaccesscontrolled": ["barrier-building-access-controlled"]
    },

    scenarios: [
      {
        id: "ncz-ledge-reduces-effective-height",
        priority: 1000,
        all: ["ncz-stepsledgesraisedareasclear"],
        any: [
          "ncz-effectivebarrierheightmaintained",
          "ncz-ncznohandholdsfootholds",
          "ncz-additionalclearareamaintained",
          "ncz-nczcompliant"
        ],
        consume: [
          "ncz-stepsledgesraisedareasclear",
          "ncz-effectivebarrierheightmaintained",
          "ncz-ncznohandholdsfootholds",
          "ncz-additionalclearareamaintained",
          "ncz-nczcompliant"
        ],
        title: "Climbable ledge / raised area affecting barrier performance",
        problem: "A step, ledge or raised area at {item} has been recorded as compromising the non-climbable zone. The same condition can provide a foothold and reduce the effective barrier height measured from the accessible climbing point.",
        why: "These failed checks describe one connected condition rather than separate defects. The raised or climbable feature changes how the barrier can be climbed and can reduce the effective height available above that feature.",
        requirement: "The relevant non-climbable zone and effective barrier height must both remain compliant. Removing or otherwise rectifying the climbable ledge/raised area may restore the effective barrier height, but the completed arrangement must be reassessed.",
        rectificationOptions: [
          "Remove or permanently modify the ledge, step or raised area so it no longer provides a climbable foothold within the applicable non-climbable zone.",
          "Where removal is not practicable, use an appropriately designed non-climbable treatment only if the final arrangement maintains the required barrier height and non-climbable zone.",
          "After rectification, remeasure the effective barrier height from the relevant accessible level and reassess the complete NCZ."
        ]
      },
      {
        id: "ncz-raised-garden-reduces-height",
        priority: 960,
        all: ["ncz-raisedgardenbedsassessed"],
        any: [
          "ncz-effectivebarrierheightmaintained",
          "ncz-ncznohandholdsfootholds",
          "ncz-additionalclearareamaintained",
          "ncz-nczcompliant"
        ],
        consume: [
          "ncz-raisedgardenbedsassessed",
          "ncz-effectivebarrierheightmaintained",
          "ncz-ncznohandholdsfootholds",
          "ncz-additionalclearareamaintained",
          "ncz-nczcompliant"
        ],
        title: "Raised garden bed affecting the NCZ / effective height",
        problem: "A raised garden bed at {item} has been recorded as creating a climbable or raised surface that affects the non-climbable zone and/or effective barrier height.",
        why: "A raised garden bed can change the accessible ground level, provide a foothold or reduce the effective barrier height even when the fence panel itself has not changed.",
        requirement: "The surrounding ground and objects must not create climbable access or reduce the effective barrier height below the applicable requirement.",
        rectificationOptions: [
          "Lower, remove or relocate the raised garden bed so it does not compromise the applicable NCZ or effective barrier height.",
          "Reconfigure the surrounding area so the required clear zone is permanently maintained.",
          "Reassess the barrier height and NCZ after the landscaping work is complete."
        ]
      },
      {
        id: "ncz-vegetation-climbability",
        priority: 940,
        all: ["ncz-nczvegetationnonclimbable"],
        any: [
          "ncz-ncznohandholdsfootholds",
          "ncz-ncz900provided",
          "ncz-effectivebarrierheightmaintained",
          "ncz-additionalclearareamaintained",
          "ncz-nczcompliant"
        ],
        consume: [
          "ncz-nczvegetationnonclimbable",
          "ncz-ncznohandholdsfootholds",
          "ncz-ncz900provided",
          "ncz-effectivebarrierheightmaintained",
          "ncz-additionalclearareamaintained",
          "ncz-nczcompliant"
        ],
        title: "Climbable vegetation affecting the non-climbable zone",
        problem: "Vegetation at {item} has been recorded as creating climbable access within the required non-climbable zone and is contributing to the associated NCZ failure(s).",
        why: "Branches, trunks or dense vegetation can act as handholds or footholds and may allow a child to gain height beside the barrier.",
        requirement: "Vegetation within the applicable NCZ must not provide climbable access or reduce the effective barrier height.",
        rectificationOptions: [
          "Trim, remove or permanently manage the vegetation so the required non-climbable zone remains clear.",
          "Remove branches, trunks or other growth that can be used as a handhold or foothold.",
          "Reassess the NCZ and effective barrier height after the vegetation is rectified."
        ]
      },
      {
        id: "ncz-object-in-clear-zone",
        priority: 920,
        anyCause: ["ncz-object-distance-900", "ncz-nczobjectsremoved"],
        any: [
          "ncz-ncznohandholdsfootholds",
          "ncz-ncz900provided",
          "ncz-effectivebarrierheightmaintained",
          "ncz-additionalclearareamaintained",
          "ncz-nczcompliant"
        ],
        consume: [
          "ncz-object-distance-900",
          "ncz-nczobjectsremoved",
          "ncz-ncznohandholdsfootholds",
          "ncz-ncz900provided",
          "ncz-effectivebarrierheightmaintained",
          "ncz-additionalclearareamaintained",
          "ncz-nczcompliant"
        ],
        title: "Climbable object affecting the non-climbable zone",
        problem: "A climbable object at {item} has been recorded within the required clear zone and is contributing to the associated NCZ/climbability failure(s).",
        why: "Objects close to the barrier can provide a foothold or handhold, allowing a child to gain height and reducing the effectiveness of the barrier.",
        requirement: "The applicable non-climbable and clear zones must remain free of objects that create climbable access.",
        rectificationOptions: [
          "Remove or permanently relocate the climbable object outside the applicable clear zone.",
          "Prevent movable items from being returned to the restricted area where this is necessary to maintain the NCZ.",
          "Reassess the NCZ and effective barrier height after the object is removed or relocated."
        ]
      },
      {
        id: "ncz-projection-or-horizontal-surface",
        priority: 900,
        anyCause: ["ncz-nczprojectionsindentationscompliant", "ncz-horizontal-surface"],
        any: ["ncz-ncznohandholdsfootholds", "ncz-nczcompliant", "ncz-effectivebarrierheightmaintained"],
        consume: [
          "ncz-nczprojectionsindentationscompliant",
          "ncz-horizontal-surface",
          "ncz-ncznohandholdsfootholds",
          "ncz-nczcompliant",
          "ncz-effectivebarrierheightmaintained"
        ],
        title: "Projection / horizontal surface creating a climbable feature",
        problem: "A projection, indentation or substantially horizontal surface at {item} has been recorded as creating a climbable feature and contributing to the associated NCZ failure(s).",
        why: "A projection or horizontal surface can function as a handhold or foothold and make the barrier easier to climb.",
        requirement: "The applicable non-climbable zone must remain free of climbable projections, indentations and horizontal surfaces.",
        rectificationOptions: [
          "Remove, modify or shield the climbable projection or horizontal surface so it no longer provides a handhold or foothold.",
          "Ensure any shielding is securely fixed and does not create another climbable feature.",
          "Reassess the complete NCZ after rectification."
        ]
      },
      {
        id: "ncz-fixture-climbability",
        priority: 880,
        all: ["ncz-tapspoweroutletsassessed"],
        any: ["ncz-ncznohandholdsfootholds", "ncz-nczcompliant", "ncz-effectivebarrierheightmaintained"],
        consume: [
          "ncz-tapspoweroutletsassessed",
          "ncz-ncznohandholdsfootholds",
          "ncz-nczcompliant",
          "ncz-effectivebarrierheightmaintained"
        ],
        title: "Fixture creating climbable access in the NCZ",
        problem: "A tap, power outlet or similar fixture at {item} has been recorded as creating or contributing to climbable access within the non-climbable zone.",
        why: "Fixtures can act as handholds or footholds and may reduce the effective protection provided by the barrier.",
        requirement: "Fixtures within the applicable NCZ must not create climbable access.",
        rectificationOptions: [
          "Relocate, remove or appropriately shield the fixture so it no longer provides a climbable feature.",
          "Ensure the rectification does not introduce a new foothold, projection or electrical/building safety issue.",
          "Reassess the NCZ after rectification."
        ]
      },
      {
        id: "gate-gap-measurement-and-assessment",
        priority: 850,
        all: ["gate-gap-under-100", "gate-gapundercompliant"],
        consume: ["gate-gap-under-100", "gate-gapundercompliant"],
        title: "Excessive gap below gate",
        problem: "The measured clearance below {item} and the inspector's compliance assessment both identify the gate-bottom gap as non-compliant.",
        why: "An excessive opening below a gate may allow a young child to pass beneath the barrier.",
        requirement: "The gate-bottom opening must satisfy the applicable maximum clearance requirement.",
        rectificationOptions: [
          "Adjust the gate, finished ground level or both so the opening is reduced to a compliant dimension.",
          "Ensure any ground-level rectification is permanent, stable and does not create another climbable feature.",
          "Remeasure the gate-bottom gap after rectification."
        ]
      },
      {
        id: "gate-latch-access-arrangement",
        priority: 840,
        anyCause: ["gate-latchshielded", "gate-latchreachthroughgaps"],
        any: ["gate-latchheightcompliant"],
        consume: ["gate-latchshielded", "gate-latchreachthroughgaps", "gate-latchheightcompliant"],
        title: "Gate latch access / shielding arrangement",
        problem: "The recorded latch access checks for {item} indicate that the release mechanism is accessible or insufficiently shielded.",
        why: "A child-accessible latch or reach-through path can allow the gate to be released even when the gate otherwise closes and latches.",
        requirement: "The latch release and any required shielding must prevent child access in the installed gate/barrier arrangement.",
        rectificationOptions: [
          "Raise, shield or reposition the latch release as appropriate for the gate construction.",
          "Reduce or shield reach-through openings near the release mechanism where required.",
          "Reassess latch accessibility from both sides of the completed barrier."
        ]
      },
      {
        id: "gate-operation-mechanical-cause",
        priority: 820,
        anyCause: ["gate-fullarc", "gate-hardwaresecure"],
        any: ["gate-selfclosing", "gate-closesfromanyposition", "gate-selflatching", "gate-latchpreventsreopening"],
        consume: [
          "gate-fullarc",
          "gate-hardwaresecure",
          "gate-selfclosing",
          "gate-closesfromanyposition",
          "gate-selflatching",
          "gate-latchpreventsreopening"
        ],
        title: "Gate hardware / movement affecting closing or latching",
        problem: "The recorded checks for {item} indicate a mechanical or movement issue that is affecting reliable self-closing and/or latching.",
        why: "Friction, obstruction, loose hardware or misalignment can prevent a pool gate from closing and latching consistently.",
        requirement: "The gate must move freely and reliably self-close and self-latch from the required open positions.",
        rectificationOptions: [
          "Remove obstructions and adjust or repair hinges, posts and gate alignment so the gate moves freely.",
          "Repair, tighten or replace defective gate hardware where necessary.",
          "After repair, test self-closing and self-latching repeatedly from the required open positions."
        ]
      },
      {
        id: "window-barrier-components",
        priority: 780,
        anyCause: ["window-opening-restricted", "window-screen-bars-fixed", "window-fixings-tools"],
        any: ["window-compliant"],
        consume: ["window-opening-restricted", "window-screen-bars-fixed", "window-fixings-tools", "window-compliant"],
        title: "Window barrier arrangement is not compliant",
        problem: "One or more components of the window barrier arrangement at {item} have been recorded as non-compliant, resulting in the overall window barrier check failing.",
        why: "The opening restriction, screen/bars/mesh and their fixings work together as one access-control arrangement.",
        requirement: "The complete window barrier arrangement must prevent non-compliant access to the pool area.",
        rectificationOptions: [
          "Rectify the failed opening restriction, screen/bars/mesh or fixings identified in the inspection.",
          "Ensure the completed restriction cannot be readily bypassed or removed where tools are required.",
          "Reassess the complete window arrangement after rectification."
        ]
      },
      {
        id: "door-access-components",
        priority: 760,
        anyCause: ["door-self-closing", "door-self-latching"],
        any: ["door-compliant"],
        consume: ["door-self-closing", "door-self-latching", "door-compliant"],
        title: "Door / building access arrangement is not compliant",
        problem: "The recorded self-closing and/or self-latching failure at {item} is contributing to the overall building-access barrier failure.",
        why: "A door used as part of an access-control arrangement must operate reliably as a complete system.",
        requirement: "The applicable building-access arrangement must satisfy the required closing, latching and access-control provisions.",
        rectificationOptions: [
          "Adjust, repair or replace the failed closing/latching components identified in the inspection.",
          "Correct alignment or hardware issues that prevent reliable operation.",
          "Reassess the complete door/access arrangement after rectification."
        ]
      },
      {
        id: "fence-fixings-and-rigidity",
        priority: 720,
        all: ["fence-fixingssecure", "fence-strengthrigid"],
        consume: ["fence-fixingssecure", "fence-strengthrigid"],
        title: "Fence fixings / rigidity defect",
        problem: "The fence at {item} has been recorded with insecure fixings and insufficient strength/rigidity, indicating one connected structural condition.",
        why: "Loose or failed fixings can allow barrier components to move, deform or lose the rigidity required for reliable barrier performance.",
        requirement: "Fence components and fixings must remain secure, stable and sufficiently rigid.",
        rectificationOptions: [
          "Repair or replace loose, missing or deteriorated fixings.",
          "Repair, reinforce or replace affected fence components or posts where movement remains after the fixings are secured.",
          "Recheck barrier rigidity, gaps and alignment after repair."
        ]
      },
      {
        id: "fence-ncz-projection",
        priority: 700,
        all: ["fence-nczclear", "fence-projectionscompliant"],
        consume: ["fence-nczclear", "fence-projectionscompliant"],
        title: "Fence projection / NCZ climbability issue",
        problem: "The fence at {item} has a recorded projection/indentation issue that is also causing the fence non-climbable zone to fail.",
        why: "Projections and indentations can act as handholds or footholds and compromise the required non-climbable zone.",
        requirement: "The fence surface and surrounding NCZ must not provide climbable features.",
        rectificationOptions: [
          "Remove, modify or shield the identified projection/indentation.",
          "Ensure the completed surface does not introduce another foothold or handhold.",
          "Reassess the fence NCZ after rectification."
        ]
      },
      {
        id: "boundary-neighbour-side",
        priority: 660,
        all: ["boundary-neighbour-clear", "boundary-compliant"],
        consume: ["boundary-neighbour-clear", "boundary-compliant"],
        title: "Boundary-side condition affecting barrier compliance",
        problem: "A neighbour-side climbability or level condition at {item} has been recorded as contributing to the boundary barrier being non-compliant.",
        why: "Objects or level changes on the adjoining side can affect effective barrier height and climbability.",
        requirement: "The boundary barrier must remain compliant when assessed with the relevant adjoining-side conditions.",
        rectificationOptions: [
          "Address the identified adjoining-side climbability/level condition or modify the boundary barrier so compliance is maintained.",
          "Coordinate access or rectification with the adjoining owner where required.",
          "Reassess the boundary barrier after the condition is rectified."
        ]
      },
      {
        id: "cpr-sign-multiple-defects",
        priority: 620,
        minMatches: 2,
        matchIds: [
          "safety-cprsignpresentsafety",
          "safety-cprsignvisible",
          "safety-cprsignweatherproof",
          "safety-cprsignminimumsize",
          "safety-cprsigncontentcompliant"
        ],
        consume: [
          "safety-cprsignpresentsafety",
          "safety-cprsignvisible",
          "safety-cprsignweatherproof",
          "safety-cprsignminimumsize",
          "safety-cprsigncontentcompliant"
        ],
        title: "CPR sign requires rectification",
        problem: "Multiple recorded checks for the CPR sign are non-compliant and are best treated as one sign/display issue.",
        why: "The sign's presence, visibility, durability, size and content form one emergency-information requirement.",
        requirement: "The installed CPR sign must satisfy all applicable display and content requirements.",
        rectificationOptions: [
          "Replace or relocate the CPR sign so all recorded sign requirements are satisfied.",
          "Confirm the replacement sign is current, durable and clearly visible from the required location."
        ]
      }
    ]
  };
})();
