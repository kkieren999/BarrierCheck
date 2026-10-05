# BarrierCheck Queensland compliance engine

Version: 2026-10-05-qld-compliance-v3

## Purpose

This engine supports a Queensland pool safety inspector by separating:

1. raw facts and evidence recorded on site;
2. atomic rule checks;
3. cross-field / conditional decisions;
4. items that still require inspector judgment or missing evidence;
5. special authorities that change how a standard applies;
6. statutory inspection workflow records; and
7. client-facing explanation.

The engine does **not** treat "reasonably satisfied" as a tolerance from the pool safety standard. If the recorded facts are insufficient for a conditional decision, the engine should prefer an inspector-review prompt over an automatic pass.

## Source hierarchy used

The implementation is based on the project source set supplied for this upgrade:

- Queensland Development Code MP 3.4 - Swimming pool barriers.
- AS 1926.1-2007, as called up and modified by QDC MP 3.4.
- AS 1926.2-2007, as called up and modified by QDC MP 3.4.
- Guideline for pool safety inspectors, effective 10 June 2024.

QDC MP 3.4 is treated as the Queensland modification layer where it changes the called-up Australian Standards.

## Main automated conditional decisions

| Scenario | Engine treatment |
| --- | --- |
| General fence effective height | At least 1200mm unless a construction-specific branch requires more. |
| Mesh / perforated fencing | Aperture <=13mm uses the 1200mm height branch; >13mm to <=100mm requires 1800mm; >100mm fails. Top and bottom strainer wire/rail evidence is retained. |
| Boundary fence | <1200mm fails. 1200-1799mm requires the NCZ outside and the additional clear area maintained. At 1800mm+ the inside NCZ may be used; an outside NCZ still requires its additional clear area. |
| High mesh barrier / cranked top | The NCZ/clear-area exception is only applied to a qualifying mesh/perforated construction with the recorded minimum height and a compliant qualifying arrangement. |
| NCZ object | Distance, climbability, upper-quadrant position and reasonable child accessibility are considered together rather than assuming every object within 900mm is automatically non-compliant. |
| Permanent body of water | Requires depth continuously >300mm, width >=1800mm, no access over/under, >=900mm return/overhang and a non-climbable return/overhang surface. |
| Outdoor building door | Direct building-door access to an outdoor pool is not accepted unless a confirmed applicable formal authority is recorded. |
| Indoor child-resistant doorset | Uses closing, latching, direction of opening, latch-release height, foothold, construction/finish, strength and garage fail-safe facts. |
| Barrier window | Uses external sill h1, internal sill h2 and the applicable bars/mesh, restricted-opening or secure-flyscreen branch. |
| Retaining wall | Separates above-pool and below-pool arrangements, slope direction/angle, effective height/NCZ and 900mm fence-intersection return/overhang. |
| Balcony / deck | Uses measured drop, proximity to barrier top and the barrier/NCZ protection method. |
| Chameleon gate | Fails for an outdoor-pool arrangement. |
| Double-leaf gate | Requires permanent fixing/central fixture evidence and self-closing/self-latching evidence for operable leaves. |
| Above-ground / inflatable pool | Records the designated pool access point and compliant enclosing barrier/gate. |
| Decommissioned / converted pool | A change to fishpond/other use is not treated as sufficient by itself; final approval evidence is recorded. |
| Temporary fencing | Approval/inspection dates, expiry and documentary reference are retained and expiry is checked against the inspection date. |

## Inspector-review policy

A manual-review item is generated where the inspector has recorded, or appears to be relying on, a compliant outcome but important supporting facts are incomplete. Examples include:

- mesh barrier with missing aperture or strainer evidence;
- strength/rigidity marked compliant without recording the assessment method;
- a boundary fence in the conditional 1200-1799mm range without its NCZ/clear-area facts;
- a lower gate latch without enough shielding/location evidence;
- a double-leaf gate without the permanent-fixing and leaf-operation evidence;
- water-body, window, retaining-wall or balcony overall Pass with incomplete branch facts;
- an above-ground pool without a designated-access decision;
- a converted pool without a final-approval decision;
- temporary fencing relied upon without approval/inspection documentation;
- an exemption, performance solution or variation without current-status/reference/scope evidence.

These review prompts are intentionally separate from confirmed non-compliance findings.

## Special authorities

The backend records:

- authority type;
- current / unverified / expired status;
- reference or decision number;
- issuing authority / certifier;
- scope;
- conditions / limitations;
- regulated-pools-register confirmation where applicable; and
- Form 17 / final inspection reference where applicable.

A performance solution is not used to override an automated decision unless it is recorded as current, referenced, registered on the regulated pools register, and linked to a Form 17/final inspection reference.

## Backend audit record

Each saved inspection retains its existing raw fields, dynamic sections, comments, photographs and findings. The compliance upgrade adds:

- compliance engine version and source hierarchy;
- pool environment;
- evaluated decision snapshot;
- rule ID and source reference for derived decisions;
- factual value and threshold used;
- decision basis / branch taken;
- manual-review items;
- structured special-authority snapshot;
- workflow snapshot and guide dates;
- workflow alerts;
- audit timeline for material outcome/authority changes; and
- issued client-report audit metadata.

The client-report audit stores the report version, compliance-engine version, finding IDs, whether the report wording/evidence selection was edited, generation/print timestamps, and a capped plain-text copy of the report that was sent to Print / Save PDF. It does not replace the raw inspection record.

## Workflow date note

The statutory workflow record includes the source-derived 2-business-day, 20-business-day, 3-month and 5-business-day pathways. Automatically derived business-day dates exclude weekends but do **not** automatically exclude Queensland public holidays. They are therefore displayed as guide dates and must be verified before statutory action. Where the inspector records an agreed/manual due date, that recorded date is retained and preferred by the engine.

## Core regression matrix

| # | Scenario | Expected |
| ---: | --- | --- |
| 1 | Mesh aperture 13mm, effective height 1200mm, strainers compliant | Pass height branch |
| 2 | Mesh aperture 14mm, effective height 1200mm | Fail height |
| 3 | Mesh aperture 14mm, effective height 1800mm, strainers compliant | Pass height/aperture branch |
| 4 | Mesh aperture 101mm | Fail aperture |
| 5 | Boundary 1199mm | Fail |
| 6 | Boundary 1200mm, outside NCZ, clear area Pass | Pass |
| 7 | Boundary 1200mm, inside NCZ | Fail |
| 8 | Boundary 1799mm, outside NCZ, clear area Pass | Pass |
| 9 | Boundary 1800mm, inside NCZ | Pass |
| 10 | Boundary 1800mm, outside NCZ, clear area Fail | Fail |
| 11 | Qualifying mesh fence 2400mm, high-barrier arrangement Pass | Ordinary NCZ check N/A |
| 12 | Non-mesh fence selecting the high-barrier exception | Fail / inspector review |
| 13 | Water depth exactly 300mm | Fail |
| 14 | Water depth 301mm, width 1800mm, access blocked, return 900mm, surface Pass | Pass |
| 15 | Water body otherwise compliant but width 1799mm | Fail |
| 16 | Outdoor pool + direct building door + no confirmed authority | Fail |
| 17 | Outdoor pool + building door + incomplete/unverified authority | Fail |
| 18 | Indoor doorset with all required recorded facts compliant | Pass |
| 19 | Indoor doorset with pet door | Fail |
| 20 | Indoor garage door without fail-safe evidence | Incomplete / cannot auto-pass |
| 21 | Window h1 >=1800mm | Pass window geometry branch |
| 22 | Window h1 <1800, h2 <=900, restricted opening 100mm + tool-only + strength Pass | Pass |
| 23 | Same branch with 101mm opening | Fail |
| 24 | Window h1 <1800, h2 901-1199mm, secure flyscreen + tool-only fixing | Pass |
| 25 | Retaining wall above pool, 1800mm, vertical, footholds/NCZ Pass | Pass |
| 26 | Retaining wall above pool slopes away 16 degrees | Fail |
| 27 | Retaining wall below pool slopes toward pool 16 degrees | Fail |
| 28 | Below-pool wall with fence intersection and return <900mm | Fail |
| 29 | Balcony drop 1700mm with no compliant protection method | Fail |
| 30 | Balcony drop 1900mm and perimeter >900mm from barrier top | Pass geometry branch |
| 31 | Outdoor chameleon gate | Fail |
| 32 | Double-leaf gate without permanent-fixing evidence | Inspector review / cannot auto-pass |
| 33 | Above-ground pool without compliant designated access point | Fail when recorded Fail; review when incomplete |
| 34 | Fishpond conversion with final approval No | Fail |
| 35 | Performance solution missing register/Form 17 evidence | Inspector review; no authority override |
| 36 | Temporary-fence approval expired before inspection | Fail |
| 37 | Building work field Pass ("does not compromise barrier") | Pass |
| 38 | Building work field Fail | Fail |
| 39 | Certificate-ready No while overall result is still Pending | No premature administrative finding |
| 40 | Owner-advised No when no rectification/reinspection action is required | N/A, not a false failure |

## Client report policy

Client reporting remains intentionally simpler than the inspector record.

- Related atomic failures may be combined into one causal physical issue.
- Physical barrier rectification items are separated from specialist safety referrals.
- Administrative/process actions are separated from physical barrier defects.
- Editing client-facing wording does not alter the recorded raw facts or compliance decisions.
- The backend retains the compliance decision/audit data independently of the report wording.

## Review limitation

This engine implements the source-mapped scenarios above. It is not a substitute for a licensed inspector's statutory function, nor should an unmodelled or incomplete physical configuration be silently treated as compliant. New source interpretations or regulatory changes should be added as versioned rule/engine changes with regression cases.
