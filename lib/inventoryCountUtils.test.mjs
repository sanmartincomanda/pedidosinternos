import test from "node:test";
import assert from "node:assert/strict";

import {
  INVENTORY_ENTRY_SALE,
  aggregateInventoryCountLines,
  validateInventoryCountLines,
} from "./inventoryCountUtils.mjs";

const baseLine = {
  articleId: 15,
  clave: "00015",
  descripcion: "IN ENTERA",
  unidad: "LB",
  currentExistence: 50,
  zona: "Camara fria",
};

test("suma lineas repetidas del mismo producto en la misma zona", () => {
  const [result] = aggregateInventoryCountLines([
    { ...baseLine, countedExistence: 25 },
    { ...baseLine, countedExistence: 36 },
  ]);

  assert.equal(result.grossCounted, 61);
  assert.equal(result.countedExistence, 61);
  assert.equal(result.countLines, 2);
  assert.deepEqual(result.zones, ["Camara fria"]);
});

test("resta ventas del conteo totalizado por clave", () => {
  const [result] = aggregateInventoryCountLines([
    { ...baseLine, countedExistence: 40, zona: "Zona 1" },
    { ...baseLine, countedExistence: 25, zona: "Zona 2" },
    { ...baseLine, countedExistence: 4, entryType: INVENTORY_ENTRY_SALE, zona: "Zona 2" },
  ]);

  assert.equal(result.grossCounted, 65);
  assert.equal(result.salesSubtracted, 4);
  assert.equal(result.countedExistence, 61);
  assert.deepEqual(result.zones, ["Zona 1", "Zona 2"]);
});

test("bloquea una resta de venta mayor que el conteo", () => {
  const validation = validateInventoryCountLines([
    { ...baseLine, countedExistence: 2 },
    { ...baseLine, countedExistence: 3, entryType: INVENTORY_ENTRY_SALE },
  ]);

  assert.equal(validation.valid, false);
  assert.match(validation.message, /superan el conteo/);
});

test("los borradores anteriores siguen siendo lineas de conteo", () => {
  const [result] = aggregateInventoryCountLines([{ ...baseLine, countedExistence: 12 }]);

  assert.equal(result.grossCounted, 12);
  assert.equal(result.salesSubtracted, 0);
  assert.equal(result.countedExistence, 12);
});
