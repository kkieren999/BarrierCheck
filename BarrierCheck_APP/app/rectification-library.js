// BarrierCheck customer-facing rectification guidance library.
// Version-controlled content only. This file is intentionally not wired into the report yet.
// The inspection rule engine remains the source of the actual pass/fail decision.
(function () {
  "use strict";

  window.BARRIER_CHECK_RECTIFICATION_LIBRARY = {
    schemaVersion: "1.0",
    contentVersion: "2026-08-10-draft1",
    jurisdiction: "Queensland",
    status: "draft-for-review",
    reportPolicy: {
      purpose: "Explain to the customer what is wrong, why it matters and possible ways the item may be rectified.",
      notForDecisionMaking: "This library does not determine compliance. Compliance is determined by the inspection rule engine and the inspector's assessment.",
      productPolicy: "Use generic product or repair types only. Do not name brands, retailers, affiliate products or products in which the inspector has a commercial or financial interest.",
      rectificationDisclaimer: "Possible rectification options are examples only. The selected repair must suit the actual barrier and site conditions, satisfy all applicable pool safety requirements, and be confirmed by inspection after the work is complete.",
      standardsCopyrightPolicy: "Use a plain-English requirement summary and exact clause reference. Avoid reproducing substantial Standards Australia text in customer reports."
    },
    sourceRegister: {
      qdcMp34: {
        title: "Queensland Development Code MP 3.4 — Swimming pool barriers",
        publicationDate: "2012-07-18",
        relationshipNote: "MP 3.4 modifies the referenced AS 1926.1—2007 and AS 1926.2—2007 provisions and prevails to the extent of inconsistency."
      },
      as19261: {
        title: "AS 1926.1—2007 Swimming pool safety — Part 1: Safety barriers for swimming pools",
        edition: "2007 incorporating Amendment No. 1"
      },
      qbccPoolSafety: {
        title: "Queensland Building and Construction Commission pool safety guidance",
        type: "official guidance",
        lastVerified: "2026-08-10"
      }
    },
    rules: {
      "fence-effective-height-1200": {
        customerTitle: "Pool barrier height is insufficient",
        customerProblemTemplate: "The effective barrier height at {location} was recorded as {value} mm, which is below the applicable minimum requirement for this barrier arrangement.",
        whyItMatters: "A barrier that is too low may make it easier for a young child to climb over and enter the pool area.",
        requirementSummary: "A pool barrier must provide the applicable effective height and maintain the required non-climbable zone. For a typical barrier, the general minimum effective height is 1200 mm, subject to the Queensland Development Code modifications and any more specific requirement that applies to the barrier type.",
        sources: [
          { document: "AS 1926.1—2007", clause: "2.1" },
          { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modifications to AS 1926.1, including measurement/NCZ provisions" }
        ],
        possibleRectificationOptions: [
          "Securely increase the effective height of the existing barrier using a permanent barrier extension or appropriately modified/rebuilt barrier.",
          "Where the measured height has been reduced by nearby ground, garden beds or raised surfaces, alter those conditions where appropriate so the required effective height is restored.",
          "Replace the affected barrier section where an extension or alteration cannot achieve a compliant arrangement."
        ],
        possibleItemTypes: [
          "permanent barrier extension system",
          "replacement compliant fence panel or barrier section"
        ],
        optionBasis: "QBCC guidance includes securely increasing fence height and reducing surrounding ground levels where appropriate.",
        cautions: [
          "Do not state that a particular extension product guarantees compliance.",
          "Check the resulting NCZ, openings, strength, rigidity and adjoining barrier intersections after modification.",
          "A local approval may be relevant for some higher fences."
        ],
        evidence: "reference-associated-fence-images"
      },

      "fence-ground-clearance-100": {
        customerTitle: "Gap below the pool barrier is too large",
        customerProblemTemplate: "The opening below the barrier at {location} was recorded as {value} mm, which exceeds the applicable maximum opening.",
        whyItMatters: "An excessive opening below a barrier may allow a young child to pass underneath the fence or gate.",
        requirementSummary: "The opening between the bottom of the barrier and the finished ground level must not exceed 100 mm. The surrounding ground must also remain stable and permanent.",
        sources: [
          { document: "AS 1926.1—2007", clause: "2.4" },
          { document: "Queensland Development Code MP 3.4", clause: "applies subject to Schedule 1 modifications" }
        ],
        possibleRectificationOptions: [
          "Provide secure permanent paving or concrete beneath the affected area to reduce the opening while maintaining the required barrier height and NCZ.",
          "Modify or replace the affected barrier section where a permanent ground solution is unsuitable."
        ],
        possibleItemTypes: [
          "secure paving",
          "concrete footing or permanent hardstand",
          "replacement compliant barrier section"
        ],
        optionBasis: "QBCC guidance identifies secure paving or concrete under a barrier as a possible way to reduce an excessive bottom gap.",
        cautions: [
          "Loose soil, sand, mulch or other easily displaced material should not be presented as a permanent rectification.",
          "Any raised surface added near the fence must be checked to ensure it does not reduce effective height or create a climbing aid."
        ],
        evidence: "reference-associated-fence-or-gate-images"
      },

      "gate-selfclosing": {
        customerTitle: "Pool gate does not self-close correctly",
        customerProblemTemplate: "The gate at {location} did not return to the closed position and operate the latch correctly from the required open positions.",
        whyItMatters: "A gate that can remain open may allow unsupervised access to the pool area by a young child.",
        requirementSummary: "A pool gate must be self-closing and must return to the closed position without manual assistance from the required open positions.",
        sources: [
          { document: "AS 1926.1—2007", clause: "2.5.3" },
          { document: "Queensland Development Code MP 3.4", clause: "Performance Requirement P1(d)" }
        ],
        possibleRectificationOptions: [
          "Adjust the existing hinges or self-closing mechanism so the gate closes reliably from all required positions.",
          "Service the hinge/self-closing mechanism where maintenance is suitable and does not mask worn or defective components.",
          "Replace the self-closing hinge or closing device with a suitable pool-gate self-closing component if the existing device cannot be adjusted to operate reliably.",
          "Repair or realign the gate, posts or latch where misalignment is preventing reliable closing."
        ],
        possibleItemTypes: [
          "pool-gate self-closing hinge set",
          "self-closing gate mechanism",
          "gate alignment/hinge repair components"
        ],
        optionBasis: "QBCC guidance includes adjusting gate hinges, maintaining hinges/latches and repairing or replacing gate components so the gate self-closes and self-latches every time.",
        cautions: [
          "Do not name a particular hinge model as compliant without confirming it is suitable for the actual gate weight, geometry and installation.",
          "After adjustment or replacement, re-check closing and latching from multiple open positions."
        ],
        evidence: "reference-associated-gate-images"
      },

      "gate-selflatching": {
        customerTitle: "Pool gate does not self-latch correctly",
        customerProblemTemplate: "The gate at {location} did not automatically latch and remain securely closed when the gate returned to the closed position.",
        whyItMatters: "If a pool gate does not latch securely, a young child may be able to push or pull the gate open and enter the pool area.",
        requirementSummary: "A pool gate must automatically operate its latching device when it closes and the latch must prevent the gate from reopening until it is manually released. The latch arrangement must also satisfy the applicable child-resistant location and shielding requirements.",
        sources: [
          { document: "AS 1926.1—2007", clause: "2.5.4, including applicable latch location/shielding provisions" },
          { document: "Queensland Development Code MP 3.4", clause: "Performance Requirement P1(d)" }
        ],
        possibleRectificationOptions: [
          "Adjust or realign the existing latch and striker so the gate automatically latches every time it closes.",
          "Repair or replace worn latch components where adjustment alone is not reliable.",
          "Install a suitable child-resistant self-latching pool-gate device where the existing latch cannot be made compliant.",
          "Correct gate sag, hinge movement or post movement where this is causing latch misalignment."
        ],
        possibleItemTypes: [
          "child-resistant self-latching pool-gate latch",
          "latch striker/keeper",
          "gate alignment or hinge repair components"
        ],
        optionBasis: "QBCC guidance includes repairing, replacing or adjusting a gate so it self-closes and self-latches each and every time.",
        cautions: [
          "A replacement latch must still satisfy the applicable release-height, access and shielding requirements for the actual gate construction.",
          "Do not state that a product is compliant merely because it is marketed for pool gates. The installed arrangement must be assessed."
        ],
        evidence: "reference-associated-gate-images"
      },

      "ncz-object-distance-900": {
        customerTitle: "Climbable object is within the non-climbable zone",
        customerProblemTemplate: "A climbable object at {location} was recorded within the required non-climbable zone of the pool barrier.",
        whyItMatters: "Furniture, vegetation, equipment, ledges and similar objects can provide a handhold or foothold that helps a young child climb the barrier.",
        requirementSummary: "The applicable non-climbable zone must be kept free of accessible climbing aids. For fences where the outside NCZ applies, Queensland guidance commonly describes keeping climbable objects 900 mm away from the outside and maintaining the applicable clear area on the inside.",
        sources: [
          { document: "AS 1926.1—2007", clause: "2.1 and applicable NCZ provisions" },
          { document: "Queensland Development Code MP 3.4", clause: "Schedule 1 modifications 6–11" }
        ],
        possibleRectificationOptions: [
          "Remove or relocate the climbable object so the required NCZ and clear area are maintained.",
          "Secure movable objects so they cannot be moved back into the required clear zone.",
          "Trim or remove climbable vegetation and overhanging branches where they compromise the NCZ.",
          "Where an object cannot reasonably be removed, provide an appropriately designed non-climbable shield if that solution can satisfy all applicable barrier requirements."
        ],
        possibleItemTypes: [
          "secure non-climbable flat shielding material",
          "permanent fixing/restraint for movable object where appropriate"
        ],
        optionBasis: "QBCC guidance identifies removal/relocation of climbable objects and, in suitable cases, securely fixed non-climbable shielding such as flat polycarbonate sheeting.",
        cautions: [
          "A shield must not introduce new footholds, openings, sharp edges or reduce the effective barrier height.",
          "If the NCZ side changes because of barrier height/type, reassess the entire relevant NCZ arrangement rather than applying a generic 900 mm instruction."
        ],
        evidence: "reference-associated-ncz-images"
      }
    }
  };
})();
