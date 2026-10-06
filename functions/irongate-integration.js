const logger = require("firebase-functions/logger");
const { onRequest } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { OAuth2Client } = require("google-auth-library");

const REGION = "australia-southeast1";
const IRONGATE_PROJECT_NUMBER = "212629212493";
const IRONGATE_SERVICE_ACCOUNT = IRONGATE_PROJECT_NUMBER + "-compute@developer.gserviceaccount.com";
const TARGET_ACCOUNT_EMAIL = "irongate.pool.bne@gmail.com";
const FUNCTION_AUDIENCE =
  "https://" + REGION + "-barriercheck-32290.cloudfunctions.net/createIronGateInspection";

const tokenVerifier = new OAuth2Client();

function clean(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function cleanPhone(value) {
  return clean(value).replace(/\s+/g, " ");
}

function mapPurpose(value) {
  const input = clean(value).toLowerCase();
  if (/sale|sell|vendor/.test(input)) return "Sale";
  if (/lease|rent|tenant/.test(input)) return "Lease";
  if (/body corporate|shared|strata/.test(input)) return "Body corporate / shared pool";
  if (/owner|certificate|compliance|initial/.test(input)) return "Owner request";
  return input ? "Other" : "Owner request";
}

function mapPoolType(value) {
  const input = clean(value).toLowerCase();
  if (!input) return "Other";
  if (/swim\s*spa/.test(input)) return "Swim spa";
  if (/spa/.test(input)) return "Spa";
  if (/above/.test(input)) return "Above-ground pool";
  if (/in[- ]?ground|inground/.test(input)) return "In-ground pool";
  if (/indoor/.test(input)) return "Indoor pool";
  if (/outdoor/.test(input)) return "Outdoor pool";
  return "Other";
}

function inspectionNumber(bookingId, booking) {
  const date = clean(booking.preferredDate);
  const year = /^\d{4}-/.test(date) ? date.slice(0, 4) : String(new Date().getUTCFullYear());
  const suffix = clean(bookingId).replace(/[^a-z0-9]/gi, "").slice(-7).toUpperCase() || "BOOKING";
  return "BC-" + year + "-IG" + suffix;
}

function bookingNotes(bookingId, booking) {
  const rows = [
    "Imported automatically from IronGate booking " + bookingId + ".",
    booking.preferredTimeLabel || booking.preferredTime
      ? "Appointment: " + clean(booking.preferredTimeLabel || booking.preferredTime)
      : "",
    booking.customerName ? "Booking contact: " + clean(booking.customerName) : "",
    booking.phone ? "Booking phone: " + cleanPhone(booking.phone) : "",
    booking.email ? "Booking email: " + clean(booking.email) : "",
    booking.agencyName ? "Agency: " + clean(booking.agencyName) : "",
    booking.accessContactName ? "Access contact: " + clean(booking.accessContactName) : "",
    booking.accessContactPhone ? "Access phone: " + cleanPhone(booking.accessContactPhone) : "",
    booking.accessMethod ? "Access method: " + clean(booking.accessMethod) : "",
    booking.keyCollectionLocation ? "Key collection: " + clean(booking.keyCollectionLocation) : "",
    booking.accessInstructions ? "Access instructions: " + clean(booking.accessInstructions) : "",
    booking.animalsOnProperty === true
      ? "Animals on property: yes" + (booking.animalsWillBeSecured === true ? " — confirmed secured." : ".")
      : "",
    booking.hasPoolExemption === true ? "Booking indicates a pool exemption may apply." : "",
    booking.notes ? "Booking notes: " + clean(booking.notes) : "",
    booking.inspectionReason ? "IronGate inspection reason: " + clean(booking.inspectionReason) : ""
  ];
  return rows.filter(Boolean).join("\n");
}

async function verifyIronGateCaller(req) {
  const header = clean(req.headers.authorization);
  if (!header.toLowerCase().startsWith("bearer ")) {
    throw Object.assign(new Error("Missing bearer token."), { statusCode: 401 });
  }

  const idToken = header.slice(7).trim();
  const ticket = await tokenVerifier.verifyIdToken({
    idToken,
    audience: FUNCTION_AUDIENCE
  });
  const payload = ticket.getPayload() || {};
  const email = clean(payload.email).toLowerCase();

  if (payload.email_verified !== true || email !== IRONGATE_SERVICE_ACCOUNT.toLowerCase()) {
    throw Object.assign(new Error("Caller is not the IronGate service account."), { statusCode: 403 });
  }
}

function prefilledInspection(bookingId, booking, profile) {
  const number = inspectionNumber(bookingId, booking);
  const now = new Date().toISOString();
  const ownerName = clean(booking.poolOwnerName || booking.customerName);
  const ownerEmail = clean(booking.poolOwnerEmail || booking.email).toLowerCase();
  const ownerPhone = cleanPhone(booking.poolOwnerPhone || booking.phone);
  const profileIcon = profile.profileIcon || { type: "default", photoURL: "", avatarId: "default" };
  const snapshot = {
    inspectorName: clean(profile.inspectorName),
    licenceNumber: clean(profile.licenceNumber),
    inspectorEmail: clean(profile.inspectorEmail),
    inspectorPhone: cleanPhone(profile.inspectorPhone),
    businessName: clean(profile.businessName),
    businessAddress: clean(profile.businessAddress),
    businessAbn: clean(profile.businessAbn),
    businessWebsite: clean(profile.businessWebsite),
    reportEmail: clean(profile.reportEmail || profile.inspectorEmail),
    reportPhone: cleanPhone(profile.reportPhone || profile.inspectorPhone),
    reportLogoUrl: clean(profile.reportLogoUrl),
    reportFooterText: clean(profile.reportFooterText),
    inspectionNumberPrefix: clean(profile.inspectionNumberPrefix || "BC"),
    profileIcon
  };

  return {
    id: "irongate-" + bookingId,
    inspectionNumber: number,
    fields: {
      inspectionNumber: number,
      inspectionDate: clean(booking.preferredDate),
      inspectorName: snapshot.inspectorName,
      licenceNumber: snapshot.licenceNumber,
      inspectorEmail: snapshot.inspectorEmail,
      inspectorPhone: snapshot.inspectorPhone,
      businessName: snapshot.businessName,
      ownerName,
      ownerPhone,
      ownerEmail,
      inspectionType: "Initial inspection",
      inspectionPurpose: mapPurpose(booking.inspectionReason),
      poolType: mapPoolType(booking.poolType),
      sharedPool: "Unknown",
      propertyAddress: clean(booking.propertyAddress),
      inspectionNotes: bookingNotes(bookingId, booking),
      preInspectionNotes: bookingNotes(bookingId, booking)
    },
    photos: {},
    fenceSections: [],
    climbabilitySections: [],
    balconySections: [],
    retainingWallSections: [],
    boundarySections: [],
    specialPoolFeatureSections: [],
    waterBarrierSections: [],
    barrierWindowSections: [],
    barrierDoorSections: [],
    gateSections: [],
    temporaryFenceSections: [],
    decommissionedPoolSections: [],
    referralSections: [],
    inspectorSnapshot: snapshot,
    findings: [],
    inspectionStarted: true,
    status: "Not started",
    completedSections: 0,
    totalSections: 5,
    progressText: "0/5 sections complete",
    source: "irongate",
    sourceBookingId: bookingId,
    sourceBookingStatus: clean(booking.status),
    sourcePaymentStatus: clean(booking.paymentStatus),
    createdAt: now,
    updatedAt: now,
    integrationSyncedAt: FieldValue.serverTimestamp()
  };
}

exports.createIronGateInspection = onRequest(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: "256MiB",
    invoker: "public"
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    try {
      await verifyIronGateCaller(req);

      const bookingId = clean(req.body && req.body.bookingId);
      const booking = req.body && req.body.booking && typeof req.body.booking === "object"
        ? req.body.booking
        : {};

      if (!/^[A-Za-z0-9_-]{8,120}$/.test(bookingId)) {
        res.status(400).json({ ok: false, error: "Invalid booking ID" });
        return;
      }

      if (clean(booking.status) !== "confirmed" ||
          !["paid", "no_payment_required", "agency_invoice"].includes(clean(booking.paymentStatus))) {
        res.status(409).json({ ok: false, error: "Booking is not confirmed and payable." });
        return;
      }

      const auth = getAuth();
      const db = getFirestore();
      const targetUser = await auth.getUserByEmail(TARGET_ACCOUNT_EMAIL);
      const userRef = db.collection("users").doc(targetUser.uid);
      const userSnap = await userRef.get();
      const user = userSnap.exists ? userSnap.data() || {} : {};
      const profile = user.inspectorProfile || {};

      if (!userSnap.exists || !clean(profile.inspectorName) || !clean(profile.licenceNumber)) {
        res.status(409).json({ ok: false, error: "BarrierCheck inspector profile is not ready." });
        return;
      }

      const inspectionId = "irongate-" + bookingId;
      const inspectionRef = userRef.collection("inspections").doc(inspectionId);
      const inspection = prefilledInspection(bookingId, booking, profile);

      const result = await db.runTransaction(async (tx) => {
        const existing = await tx.get(inspectionRef);
        if (existing.exists) {
          return { created: false };
        }
        tx.create(inspectionRef, inspection);
        return { created: true };
      });

      logger.info("IronGate booking synced to BarrierCheck", {
        bookingId,
        inspectionId,
        created: result.created,
        targetUid: targetUser.uid
      });

      res.status(200).json({
        ok: true,
        inspectionId,
        created: result.created
      });
    } catch (error) {
      const status = Number(error && error.statusCode) || 500;
      logger.error("IronGate BarrierCheck import failed", {
        status,
        message: error && error.message ? error.message : String(error)
      });
      res.status(status).json({
        ok: false,
        error: status >= 500 ? "BarrierCheck import failed." : error.message
      });
    }
  }
);

exports._test = {
  mapPurpose,
  mapPoolType,
  inspectionNumber,
  bookingNotes,
  prefilledInspection
};
