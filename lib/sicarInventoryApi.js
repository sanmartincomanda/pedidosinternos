import {
  applySicarInventoryAdjustment,
  checkSicarPurchaseApi,
  getSicarInventoryCatalog as getLocalInventoryCatalog,
  getSicarInventoryHistory as getLocalInventoryHistory,
  previewSicarInventoryAdjustment,
} from "@/lib/sicarPurchaseApi";
import {
  buildLegacyInventoryBatches,
  isInventoryCommandLengthError,
  mergeInventorySummaries,
} from "@/lib/inventoryApiBatching.mjs";

function normalizeHistoryRow(row = {}) {
  const marker = `${row.comentario || ""}`.match(/\[CSM-INVENTARIO:([^\]]+)\]/i)?.[1] || "";
  return {
    id: `${row.ain_id || marker}`,
    sessionId: marker,
    folio: marker || `AJ-${row.ain_id || ""}`,
    status: "done",
    ainId: Number(row.ain_id || 0) || null,
    processedAt: row.fecha || null,
    message: `Ajuste aplicado en SICAR${row.ain_id ? ` #${row.ain_id}` : ""}.`,
    summary: {
      changedLines: Number(row.lineas || 0),
      positiveLines: Number(row.positivas || 0),
      negativeLines: Number(row.negativas || 0),
      totalDifferenceUnits: Number(row.diferenciaUnidades || 0),
      totalDifferenceCost: Number(row.diferenciaCosto || 0),
    },
  };
}

function aggregatePayloadItems(items = []) {
  const totals = new Map();
  items.forEach((item) => {
    const articleId = Number(item.articleId ?? item.art_id);
    const countedExistence = Number(item.cantidadContada ?? item.countedExistence);
    if (!Number.isInteger(articleId) || articleId <= 0 || !Number.isFinite(countedExistence)) return;
    const current = totals.get(articleId) || {
      articleId,
      countedExistence: 0,
      expectedExistence: Number(item.expectedExistence),
    };
    current.countedExistence = Math.round((current.countedExistence + countedExistence + Number.EPSILON) * 10000) / 10000;
    totals.set(articleId, current);
  });
  return [...totals.values()];
}

function buildApiPayload(payload = {}, previewLines = null) {
  const previewByArticle = new Map(
    (previewLines || []).map((line) => [Number(line.articleId), Number(line.currentExistence)]),
  );
  return {
    requestId: payload.sessionId || payload.requestId,
    date: payload.fecha || payload.date,
    notes: payload.observaciones || payload.notes || "",
    operator: payload.realizadoPor || payload.operator || "CSM Operaciones",
    branch: payload.branchAlias || payload.branchId || payload.branch,
    items: aggregatePayloadItems(payload.items || []).map((item) => {
      const articleId = item.articleId;
      return {
        articleId,
        countedExistence: item.countedExistence,
        expectedExistence: previewByArticle.has(articleId)
          ? previewByArticle.get(articleId)
          : Number(item.expectedExistence),
      };
    }),
  };
}

export async function checkSicarInventoryApi() {
  const health = await checkSicarPurchaseApi();
  return {
    ...health,
    writes: {
      ...(health.writes || {}),
      inventoryAdjustments: health.writes?.inventoryAdjustments === true,
    },
  };
}

export async function getSicarInventoryCatalog() {
  const result = await getLocalInventoryCatalog();
  return {
    ...result,
    branch: {
      id: result.branch?.sucId || result.branch?.id,
      alias: result.branch?.alias || "Sucursal SICAR",
    },
    catalog: { source: "sicar-local-api", updatedAt: result.generatedAt || new Date().toISOString() },
  };
}

export async function getInventoryAdjustmentRequests(requestLimit = 100) {
  const result = await getLocalInventoryHistory(requestLimit);
  return { ok: true, source: "sicar-mysql", rows: (result.rows || []).map(normalizeHistoryRow) };
}

export function getSicarInventoryHistory(requestLimit = 100) {
  return getInventoryAdjustmentRequests(requestLimit);
}

export async function previewInventoryAdjustmentRequest(payload) {
  const apiPayload = buildApiPayload(payload);
  try {
    const result = await previewSicarInventoryAdjustment(apiPayload);
    return { ...result, apiPayload: buildApiPayload(payload, result.lines || []) };
  } catch (error) {
    if (!isInventoryCommandLengthError(error)) throw error;
    const batches = buildLegacyInventoryBatches(apiPayload);
    if (!batches.length) throw error;

    const previews = [];
    for (const batch of batches) {
      const result = await previewSicarInventoryAdjustment(batch);
      const currentByArticle = new Map((result.lines || []).map((line) => [Number(line.articleId), Number(line.currentExistence)]));
      previews.push({
        ...batch,
        items: batch.items.map((item) => ({
          ...item,
          expectedExistence: currentByArticle.get(Number(item.articleId)),
        })),
        result,
      });
    }
    return {
      ok: true,
      source: previews[0]?.result?.source || "sicar-mysql",
      branch: previews[0]?.result?.branch,
      lines: previews.flatMap((batch) => batch.result.lines || []),
      summary: mergeInventorySummaries(previews.map((batch) => batch.result.summary)),
      apiPayload: buildApiPayload(payload, previews.flatMap((batch) => batch.result.lines || [])),
      legacyBatches: previews.map(({ result: _result, ...batch }) => batch),
    };
  }
}

export async function submitInventoryAdjustmentRequest(payload, preview) {
  const apiPayload = preview?.apiPayload || buildApiPayload(payload, preview?.lines || []);
  let result;
  let legacyBatches = preview?.legacyBatches || null;
  if (!legacyBatches) {
    try {
      result = await applySicarInventoryAdjustment(apiPayload);
    } catch (error) {
      if (!isInventoryCommandLengthError(error)) throw error;
      legacyBatches = buildLegacyInventoryBatches(apiPayload);
      if (!legacyBatches.length) throw error;
    }
  }
  if (legacyBatches) {
    const results = [];
    for (const batch of legacyBatches) {
      try {
        results.push(await applySicarInventoryAdjustment(batch));
      } catch (error) {
        const completed = results.length;
        throw new Error(`${error.message} Se completaron ${completed} de ${legacyBatches.length} bloques. No borres el levantamiento; vuelve a revisar y aplicar para continuar sin duplicar.`);
      }
    }
    const adjustments = results.map((item) => item.adjustment).filter(Boolean);
    result = {
      duplicate: results.every((item) => item.duplicate === true),
      noChanges: results.every((item) => item.duplicate === true || item.noChanges === true),
      adjustment: adjustments[0] || null,
      adjustments,
      legacyBatched: true,
      batchCount: legacyBatches.length,
      summary: mergeInventorySummaries(results.map((item) => item.summary)),
    };
  }
  const request = {
    id: apiPayload.requestId,
    sessionId: apiPayload.requestId,
    folio: payload.folio || apiPayload.requestId,
    status: result.duplicate ? "duplicate" : "done",
    ainId: result.adjustment?.ain_id || null,
    processedAt: new Date().toISOString(),
    message: result.legacyBatched
      ? `Levantamiento aplicado en ${result.batchCount} bloques SICAR${result.adjustments.length ? ` (${result.adjustments.map((item) => `#${item.ain_id}`).join(", ")})` : ""}.`
      : result.duplicate
      ? "Este levantamiento ya habia sido aplicado; no se duplico."
      : result.noChanges
        ? "El levantamiento no contiene diferencias."
        : `Ajuste aplicado en SICAR #${result.adjustment?.ain_id}.`,
    summary: result.summary,
    ainIds: result.adjustments?.map((item) => item.ain_id) || [],
  };
  return {
    ok: true,
    created: !result.duplicate,
    alreadySubmitted: Boolean(result.duplicate),
    requiresRetry: false,
    request,
  };
}
