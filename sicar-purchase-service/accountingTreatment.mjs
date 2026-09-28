import { pbkdf2Sync, timingSafeEqual } from "node:crypto";

export const FIXED_QUOTA_TAX_REGIME = "fixed-quota";
export const GENERAL_TAX_REGIME = "general";

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function authorizationError(message, statusCode = 403) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function isFixedQuotaAccounting(accounting = {}) {
  return accounting?.supplierTaxRegime === FIXED_QUOTA_TAX_REGIME || accounting?.fixedQuota === true;
}

export function assertFixedQuotaPin(pin, fixedQuotaConfig = {}) {
  if (fixedQuotaConfig.enabled !== true) {
    throw authorizationError("La autorizacion de cuota fija no esta habilitada en este servidor.", 503);
  }

  const normalizedPin = `${pin || ""}`.trim();
  if (!/^\d{4,8}$/.test(normalizedPin)) {
    throw authorizationError("PIN de cuota fija incorrecto.");
  }

  const iterations = Math.trunc(Number(fixedQuotaConfig.pinIterations || 120000));
  if (iterations < 100000 || iterations > 1000000) {
    throw authorizationError("La autorizacion de cuota fija no esta configurada correctamente.", 503);
  }

  let salt;
  let expectedHash;
  try {
    salt = Buffer.from(`${fixedQuotaConfig.pinSalt || ""}`, "base64");
    expectedHash = Buffer.from(`${fixedQuotaConfig.pinHash || ""}`, "base64");
  } catch {
    throw authorizationError("La autorizacion de cuota fija no esta configurada correctamente.", 503);
  }
  if (salt.length < 16 || expectedHash.length !== 32) {
    throw authorizationError("La autorizacion de cuota fija no esta configurada correctamente.", 503);
  }

  const actualHash = pbkdf2Sync(normalizedPin, salt, iterations, expectedHash.length, "sha256");
  if (!timingSafeEqual(actualHash, expectedHash)) {
    throw authorizationError("PIN de cuota fija incorrecto.");
  }
  return true;
}

export function buildPurchaseAccountingTreatment(accounting = {}, summary = {}, options = {}) {
  const fixedQuota = isFixedQuotaAccounting(accounting);
  if (fixedQuota && options.fixedQuotaAuthorized !== true) {
    throw authorizationError("Debes autorizar la compra de cuota fija antes de continuar.");
  }

  const sicarSubtotal = roundMoney(summary.subtotal);
  const sicarTaxTotal = roundMoney(summary.taxes);
  const sicarTotal = roundMoney(summary.total);
  const accountingTaxTotal = fixedQuota ? 0 : sicarTaxTotal;
  const accountingTotal = fixedQuota ? sicarSubtotal : sicarTotal;

  return {
    supplierTaxRegime: fixedQuota ? FIXED_QUOTA_TAX_REGIME : GENERAL_TAX_REGIME,
    fixedQuota,
    excludeRecoverableVat: fixedQuota,
    subtotal: sicarSubtotal,
    recoverableVat: accountingTaxTotal,
    total: accountingTotal,
    sicarSubtotal,
    sicarTaxTotal,
    sicarTotal,
  };
}
