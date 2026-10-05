# BarrierCheck compliance engine QA matrix

This matrix is the manual regression checklist for `compliance-engine.js`. It is intentionally source-backed and distinguishes deterministic results from inspector-review cases.

| Scenario | Recorded facts | Expected engine result | Basis |
|---|---|---|---|
| Boundary fence below minimum | Boundary fence 1199 mm | Fail | QDC MP 3.4 Schedule 1 modifications 6–7 |
| Lower boundary fence with outside NCZ | Boundary fence 1200–1799 mm; NCZ outside | Pass | QDC MP 3.4 Schedule 1 modifications 6–7 |
| Lower boundary fence with inside NCZ | Boundary fence 1200–1799 mm; NCZ inside | Fail | QDC MP 3.4 Schedule 1 modifications 6–7 |
| Mesh small aperture | Mesh aperture <=13 mm; effective height >=1200 mm; top/bottom strainers present | Pass dimensional branch | AS 1926.1—2007 cl 2.3.2 |
| Mesh medium aperture too low | Mesh aperture 14–100 mm; height <1800 mm | Fail | AS 1926.1—2007 cl 2.3.2 |
| Mesh opening too large | Mesh aperture >100 mm | Fail | AS 1926.1—2007 cl 2.3.2 |
| Mesh missing strainer | Mesh top or bottom strainer absent | Fail | AS 1926.1—2007 cl 2.3.2 |
| Object merely inside 900 mm | Object distance <900 mm but climbability/accessibility facts incomplete | Review | QDC MP 3.4 modification 8 / PSI guideline NCZ |
| Accessible climbable object | Distance <900 mm; horizontal surface >10 mm; accessible; supports climbing | Fail | PSI guideline NCZ |
| Non-climbable/inaccessible feature | Distance <900 mm; recorded inaccessible or unable to support climbing | Pass recorded branch | QDC MP 3.4 modification 8 / PSI guideline |
| Outdoor direct building door | Outdoor pool; direct doorset access; no applicable authority | Fail | AS 1926.2—2007 cl 4.2 as modified; PSI guideline |
| Direct door with special authority | Outdoor pool; direct access; authority recorded as applying | Review, not automatic pass | PSI guideline exemptions/performance solutions/variations |
| Indoor direct doorset incomplete | Indoor pool; direct access; closing/latching/swing evidence incomplete | Review | QDC MP 3.4 modification 26 / AS 1926.2 cl 4.4.1 |
| Water depth exactly 300 mm | Water body relied on as barrier; depth 300 mm | Fail | QDC MP 3.4 modification 17 requires continuously more than 300 mm |
| Water width too small | Depth >300 mm; width <1800 mm | Fail | QDC MP 3.4 modification 17 |
| Water arrangement incomplete | Any required depth/width/access/intersection fact missing | Review | QDC MP 3.4 modification 17 |
| Low window branch compliant | h1 <1800; h2 <=900; restricted opening <=100 mm with tool-removable fixing, or compliant fixed bars/mesh | Pass recorded branch | AS 1926.1—2007 cl 2.7(a) |
| Low window branch deficient | h1 <1800; h2 <=900; selected protection method does not meet recorded requirements | Fail | AS 1926.1—2007 cl 2.7(a) |
| Other window branch | h1 <1800; h2 >900 and available facts do not establish a permitted branch | Review | AS 1926.1—2007 cl 2.7 |
| Retaining wall above pool too low | Above-pool retaining wall; effective height <1800 mm | Fail | AS 1926.1—2007 cl 2.6.1 |
| Fence/retaining-wall intersection untreated | Intersection present; required treatment recorded No | Fail | AS 1926.1—2007 cl 2.6.2 / QDC modification 16 |
| Balcony dimensional trigger | Drop <1800 mm or perimeter within 900 mm of barrier; barrier/NCZ assessment incomplete | Review or fail according to recorded barrier result | AS 1926.1—2007 cl 2.9 / QDC modifications 19–20 |
| Chameleon gate at outdoor pool | Chameleon arrangement = Yes; pool context = outdoor | Fail | PSI guideline — Chameleon gates |
| Double-leaf gate incomplete | Double leaf; permanent fixed leaf/fixture or individual self-closing/latching missing | Review/Fail | PSI guideline — Leaf (swing) gates |
| Lower latch marked compliant without evidence | Latch <1500 mm; inspector marks height compliant; lower-latch geometry not recorded | Review | AS 1926.1—2007 cl 2.5.4.2–2.5.4.3 |
| Above-ground access point not enclosed | Above-ground/inflatable feature; designated access enclosure = No | Fail | QDC MP 3.4 modification 21 / AS 1926.1 cl 2.10 |
| Temporary fence approval incomplete | Temporary fence relied on; approval/current period missing | Review | QDC MP 3.4 modifications 3–4 / PSI guideline |
| Building work compromises barrier | Building-work assessment = Fail | Fail | QDC MP 3.4 modifications 3–4 / PSI guideline |
| Fishpond/decommission claim without final approval | Conversion/decommissioning relied on; final approval not sighted | Review | PSI guideline — Decommissioning / fishpond conversion |
| Authority lacks scope/verification | Exemption/performance solution/variation entered but not verified or scope blank | Review | PSI guideline — obtaining relevant facts / record keeping |
| Notice required but issue date missing | Nonconformity notice required = Yes; issue date blank | Review | PSI guideline — Nonconformity |
| Specialist electrical/asbestos/fire observation | Relevant finding exists | Separate client referral section, not counted as a pool-barrier defect | PSI guideline — other considerations |

## Regression expectations

- Existing raw inspection answers and photographs remain stored.
- New conditional fields are stored inside their relevant dynamic section.
- A top-level `complianceAudit` snapshot is stored with engine version, authorities, derived decisions, reasons, actions, sources and pass/fail/review counts.
- `review` decisions are visible to the inspector but are **not** converted into client-facing non-compliance findings.
- Derived `fail` decisions are included in the client report with rectification guidance.
- Electrical, bonding, asbestos and fire referrals are rendered separately from pool-barrier non-compliance items.
- The engine must not automatically treat a special authority as a pass; the inspector must verify its scope and record the rationale.
