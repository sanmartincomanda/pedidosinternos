import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import test from "node:test";
import {
  assertFixedQuotaPin,
  buildPurchaseAccountingTreatment,
  FIXED_QUOTA_TAX_REGIME,
  GENERAL_TAX_REGIME,
} from "./accountingTreatment.mjs";

function fixedQuotaConfig(pin = "5831") {
  const salt = randomBytes(16);
  const iterations = 120000;
  return {
    enabled: true,
    pinIterations: iterations,
    pinSalt: salt.toString("base64"),
    pinHash: pbkdf2Sync(pin, salt, iterations, 32, "sha256").toString("base64"),
  };
}

test("una compra general conserva el IVA y total calculados para SICAR", () => {
  const result = buildPurchaseAccountingTreatment({}, { subtotal: 100, taxes: 15, total: 115 });
  assert.equal(result.supplierTaxRegime, GENERAL_TAX_REGIME);
  assert.equal(result.recoverableVat, 15);
  assert.equal(result.total, 115);
  assert.equal(result.excludeRecoverableVat, false);
});

test("cuota fija usa el subtotal como total contable e IVA acreditable cero", () => {
  const result = buildPurchaseAccountingTreatment(
    { supplierTaxRegime: FIXED_QUOTA_TAX_REGIME },
    { subtotal: 100, taxes: 15, total: 115 },
    { fixedQuotaAuthorized: true },
  );
  assert.equal(result.supplierTaxRegime, FIXED_QUOTA_TAX_REGIME);
  assert.equal(result.recoverableVat, 0);
  assert.equal(result.total, 100);
  assert.equal(result.sicarTotal, 115);
  assert.equal(result.excludeRecoverableVat, true);
});

test("cuota fija no se puede construir sin autorizacion previa", () => {
  assert.throws(
    () => buildPurchaseAccountingTreatment(
      { supplierTaxRegime: FIXED_QUOTA_TAX_REGIME },
      { subtotal: 100, taxes: 15, total: 115 },
    ),
    /autorizar la compra de cuota fija/i,
  );
});

test("el PIN se verifica contra PBKDF2 y nunca contra texto plano", () => {
  const config = fixedQuotaConfig();
  assert.equal(assertFixedQuotaPin("5831", config), true);
  assert.throws(() => assertFixedQuotaPin("4321", config), /PIN de cuota fija incorrecto/i);
});
