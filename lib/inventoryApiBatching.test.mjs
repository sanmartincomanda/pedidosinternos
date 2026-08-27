import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLegacyInventoryBatches,
  isInventoryCommandLengthError,
  mergeInventorySummaries,
} from "./inventoryApiBatching.mjs";

test("divide un levantamiento grande sin repetir articulos", () => {
  const items = Array.from({ length: 511 }, (_, index) => ({ articleId: index + 1 }));
  const batches = buildLegacyInventoryBatches({ requestId: "inventory-session-123", items });

  assert.equal(batches.length, 21);
  assert.equal(batches[0].items.length, 25);
  assert.equal(batches.at(-1).items.length, 11);
  assert.equal(new Set(batches.flatMap((batch) => batch.items.map((item) => item.articleId))).size, 511);
  assert.equal(batches[0].requestId, "inventory-session-123_p1of21");
  assert.equal(batches.at(-1).requestId, "inventory-session-123_p21of21");
});

test("no activa bloques cuando el levantamiento ya es pequeno", () => {
  assert.deepEqual(buildLegacyInventoryBatches({ requestId: "inventory-session-123", items: [{ articleId: 1 }] }), []);
});

test("detecta solamente errores de longitud de comando", () => {
  assert.equal(isInventoryCommandLengthError(new Error("spawn ENAMETOOLONG")), true);
  assert.equal(isInventoryCommandLengthError(new Error("La existencia cambio")), false);
});

test("combina los resumenes de todos los bloques", () => {
  const result = mergeInventorySummaries([
    { totalLines: 25, changedLines: 20, positiveLines: 5, negativeLines: 15, totalDifferenceUnits: 10.1234, totalDifferenceCost: 100.25 },
    { totalLines: 11, changedLines: 8, positiveLines: 3, negativeLines: 5, totalDifferenceUnits: -2.1, totalDifferenceCost: -20.2 },
  ]);

  assert.deepEqual(result, {
    totalLines: 36,
    changedLines: 28,
    positiveLines: 8,
    negativeLines: 20,
    totalDifferenceUnits: 8.0234,
    totalDifferenceCost: 80.05,
  });
});
