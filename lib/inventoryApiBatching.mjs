export const LEGACY_INVENTORY_BATCH_SIZE = 25;

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

export function isInventoryCommandLengthError(error) {
  const message = `${error?.message || error || ""}`.toLowerCase();
  return message.includes("enametoolong") || message.includes("command line is too long");
}

export function buildLegacyInventoryBatches(apiPayload, batchSize = LEGACY_INVENTORY_BATCH_SIZE) {
  const items = Array.isArray(apiPayload?.items) ? apiPayload.items : [];
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error("Tamano de bloque invalido.");
  if (items.length <= batchSize) return [];

  const total = Math.ceil(items.length / batchSize);
  const requestId = `${apiPayload.requestId || "inventory"}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  return Array.from({ length: total }, (_, index) => {
    const suffix = `_p${index + 1}of${total}`;
    return {
      ...apiPayload,
      requestId: `${requestId.slice(0, 80 - suffix.length)}${suffix}`,
      items: items.slice(index * batchSize, (index + 1) * batchSize),
      batch: { index: index + 1, total },
    };
  });
}

export function mergeInventorySummaries(summaries = []) {
  return summaries.reduce((total, summary = {}) => ({
    totalLines: total.totalLines + Number(summary.totalLines || 0),
    changedLines: total.changedLines + Number(summary.changedLines || 0),
    positiveLines: total.positiveLines + Number(summary.positiveLines || 0),
    negativeLines: total.negativeLines + Number(summary.negativeLines || 0),
    totalDifferenceUnits: round(total.totalDifferenceUnits + Number(summary.totalDifferenceUnits || 0), 4),
    totalDifferenceCost: round(total.totalDifferenceCost + Number(summary.totalDifferenceCost || 0), 2),
  }), {
    totalLines: 0,
    changedLines: 0,
    positiveLines: 0,
    negativeLines: 0,
    totalDifferenceUnits: 0,
    totalDifferenceCost: 0,
  });
}
