const crypto = require("crypto");

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

initializeApp();

const db = getFirestore();
const trialHmacSecret = defineSecret("TRIAL_HMAC_SECRET");
const REGION = "australia-southeast1";
const POLICY_VERSION = "2026-06-free-trial-v1";

function clean(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeLicence(value) {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeAuPhone(value) {
  const phone = clean(value).replace(/[\s\-()]/g, "");
  if (!phone) return "";
  if (phone.startsWith("+")) return phone;
  if (phone.startsWith("04")) return "+61" + phone.slice(1);
  if (phone.startsWith("4") && phone.length === 9) return "+61" + phone;
  return phone;
}

function hmac(value, type) {
  const secret = trialHmacSecret.value();
  if (!secret || secret.length < 32) {
    throw new HttpsError("failed-precondition", "TRIAL_HMAC_SECRET is not configured correctly.");
  }
  return crypto.createHmac("sha256", secret).update(type + ":" + value).digest("hex");
}

function assertRequired(data) {
  const fullName = clean(data.fullName);
  const email = clean(data.email).toLowerCase();
  const phone = normalizeAuPhone(data.phone);
  const licenceNumber = clean(data.licenceNumber);
  const businessName = clean(data.businessName);
  const licenceNormalised = normalizeLicence(licenceNumber);

  const missing = [];
  if (!fullName) missing.push("fullName");
  if (!email) missing.push("email");
  if (!phone) missing.push("phone");
  if (!licenceNormalised) missing.push("licenceNumber");
  if (!businessName) missing.push("businessName");

  if (missing.length) {
    throw new HttpsError("invalid-argument", "Missing required signup fields.", { missing });
  }

  return { fullName, email, phone, licenceNumber, licenceNormalised, businessName };
}

function inspectorProfileFrom(input, authUser) {
  return {
    inspectorName: input.fullName || authUser.displayName || "",
    licenceNumber: input.licenceNumber || "",
    inspectorEmail: input.email || authUser.email || "",
    inspectorPhone: input.phone || authUser.phoneNumber || "",
    businessName: input.businessName || "",
    businessAddress: "",
    businessAbn: "",
    businessWebsite: "",
    reportEmail: input.email || authUser.email || "",
    reportPhone: input.phone || authUser.phoneNumber || "",
    reportLogoUrl: "",
    reportFooterText: "",
    inspectionNumberPrefix: "BC",
    profileIcon: authUser.photoURL
      ? { type: "google", photoURL: authUser.photoURL, avatarId: "" }
      : { type: "default", photoURL: "", avatarId: "default" }
  };
}

function profileIsComplete(profile) {
  return Boolean(
    profile &&
    profile.inspectorName &&
    profile.licenceNumber &&
    profile.inspectorEmail &&
    profile.inspectorPhone &&
    profile.businessName &&
    profile.profileIcon &&
    profile.profileIcon.type
  );
}

exports.createAccountProfile = onCall(
  { region: REGION, secrets: [trialHmacSecret] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before creating an account profile.");
    }

    const uid = request.auth.uid;
    const data = request.data || {};
    const input = assertRequired(data);
    const authUser = await getAuth().getUser(uid);

    const licenceHash = hmac(input.licenceNormalised, "licence");
    const phoneHash = hmac(input.phone, "phone");
    const userRef = db.collection("users").doc(uid);
    const licenceEntitlementRef = db.collection("trialEntitlements").doc("licence_" + licenceHash);
    const phoneEntitlementRef = db.collection("trialEntitlements").doc("phone_" + phoneHash);

    const result = await db.runTransaction(async (tx) => {
      const [userSnap, licenceSnap, phoneSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(licenceEntitlementRef),
        tx.get(phoneEntitlementRef)
      ]);

      const existingUser = userSnap.exists ? userSnap.data() || {} : null;
      const alreadyUsed = Boolean(
        (licenceSnap.exists && (licenceSnap.data() || {}).trialUsed === true) ||
        (phoneSnap.exists && (phoneSnap.data() || {}).trialUsed === true)
      );

      const freeLimit = existingUser && typeof existingUser.freeInspectionLimit === "number"
        ? existingUser.freeInspectionLimit
        : alreadyUsed
          ? 0
          : 3;

      const entitlementStatus = freeLimit > 0 ? "granted" : "already_used";
      const profile = inspectorProfileFrom(input, authUser);
      const providerIds = (authUser.providerData || []).map((provider) => provider.providerId).filter(Boolean);

      const userPayload = {
        email: authUser.email || input.email,
        displayName: input.fullName || authUser.displayName || "",
        phoneNumber: authUser.phoneNumber || input.phone,
        approved: false,
        admin: false,
        role: "pending",
        verificationStatus: "pending",
        verificationMethod: "manual_qbcc_register",
        billingAccess: freeLimit > 0 ? "free_inspections" : "trial_already_used",
        subscriptionStatus: freeLimit > 0 ? "free_inspections" : "trial_already_used",
        freeInspectionLimit: freeLimit,
        freeInspectionsUsed: existingUser && typeof existingUser.freeInspectionsUsed === "number" ? existingUser.freeInspectionsUsed : 0,
        freeInspectionsStartedAt: existingUser && existingUser.freeInspectionsStartedAt ? existingUser.freeInspectionsStartedAt : FieldValue.serverTimestamp(),
        freeTrialPolicyVersion: POLICY_VERSION,
        freeTrialEligibilityNoticeAccepted: true,
        freeTrialEligibilityNoticeAcceptedAt: FieldValue.serverTimestamp(),
        trialEntitlementCheckStatus: entitlementStatus,
        deletionDoesNotResetTrial: true,
        providerIds,
        inspectorProfile: profile,
        profileCompleted: profileIsComplete(profile),
        updatedAt: FieldValue.serverTimestamp()
      };

      if (!existingUser || !existingUser.createdAt) {
        userPayload.createdAt = FieldValue.serverTimestamp();
      }

      tx.set(userRef, userPayload, { merge: true });

      const entitlementPayloadBase = {
        trialUsed: true,
        policyVersion: POLICY_VERSION,
        freeInspectionLimitGranted: alreadyUsed ? 0 : 3,
        lastSignupAt: FieldValue.serverTimestamp(),
        lastSignupUserId: uid,
        signupCount: FieldValue.increment(1),
        retentionReason: "free_trial_eligibility"
      };

      tx.set(licenceEntitlementRef, {
        ...entitlementPayloadBase,
        type: "licence",
        hash: licenceHash,
        firstTrialAt: licenceSnap.exists ? (licenceSnap.data() || {}).firstTrialAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp()
      }, { merge: true });

      tx.set(phoneEntitlementRef, {
        ...entitlementPayloadBase,
        type: "phone",
        hash: phoneHash,
        firstTrialAt: phoneSnap.exists ? (phoneSnap.data() || {}).firstTrialAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp()
      }, { merge: true });

      return { freeInspectionLimit: freeLimit, trialEntitlementCheckStatus: entitlementStatus };
    });

    return { ok: true, uid, ...result };
  }
);

async function handleAccountDeletion(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before deleting an account.");
  }

  const data = request.data || {};
  if (clean(data.confirm).toUpperCase() !== "DELETE") {
    throw new HttpsError("invalid-argument", "Type DELETE to confirm account deletion.");
  }

  const uid = request.auth.uid;
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
    return { ok: true, status: "deleted" };
  }

  const user = userSnap.data() || {};
  const profile = user.inspectorProfile || {};
  const licenceNormalised = normalizeLicence(profile.licenceNumber || user.licenceNumber || "");
  const phone = normalizeAuPhone(profile.inspectorPhone || user.phoneNumber || "");
  const deletionRecordRef = db.collection("accountDeletionRecords").doc(uid);

  await db.runTransaction(async (tx) => {
    tx.set(deletionRecordRef, {
      userId: uid,
      requestedAt: FieldValue.serverTimestamp(),
      status: "deleted",
      retentionReason: "account_deletion_audit_and_free_trial_eligibility",
      policyVersion: POLICY_VERSION
    }, { merge: true });

    if (licenceNormalised) {
      const licenceHash = hmac(licenceNormalised, "licence");
      tx.set(db.collection("trialEntitlements").doc("licence_" + licenceHash), {
        type: "licence",
        hash: licenceHash,
        trialUsed: true,
        lastAccountDeletedAt: FieldValue.serverTimestamp(),
        retentionReason: "free_trial_eligibility",
        policyVersion: POLICY_VERSION
      }, { merge: true });
    }

    if (phone) {
      const phoneHash = hmac(phone, "phone");
      tx.set(db.collection("trialEntitlements").doc("phone_" + phoneHash), {
        type: "phone",
        hash: phoneHash,
        trialUsed: true,
        lastAccountDeletedAt: FieldValue.serverTimestamp(),
        retentionReason: "free_trial_eligibility",
        policyVersion: POLICY_VERSION
      }, { merge: true });
    }

    tx.set(userRef, {
      deletionRequestedAt: FieldValue.serverTimestamp(),
      deletionStatus: "deleted",
      role: "deleted",
      billingAccess: "blocked",
      subscriptionStatus: "blocked",
      email: FieldValue.delete(),
      displayName: FieldValue.delete(),
      phoneNumber: FieldValue.delete(),
      inspectorProfile: FieldValue.delete(),
      profileCompleted: false,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  try {
    await getAuth().deleteUser(uid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }

  return { ok: true, status: "deleted" };
}

exports.requestAccountDeletion = onCall(
  { region: REGION, secrets: [trialHmacSecret] },
  handleAccountDeletion
);

// Backwards-compatible name for the current app UI.
exports.deleteMyAccount = onCall(
  { region: REGION, secrets: [trialHmacSecret] },
  handleAccountDeletion
);
