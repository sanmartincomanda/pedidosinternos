import {
  applySicarInventoryAdjustment,
  checkSicarPurchaseApi,
  getSicarInventoryCatalog as getLocalInventoryCatalog,
  getSicarInventoryHistory as getLocalInventoryHistory,
  previewSicarInventoryAdjustment,
} from "@/lib/sicarPurchaseApi";

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
    items: (payload.items || []).map((item) => {
      const articleId = Number(item.articleId ?? item.art_id);
      return {
        articleId,
        countedExistence: Number(item.cantidadContada ?? item.countedExistence),
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
  const result = await previewSicarInventoryAdjustment(buildApiPayload(payload));
  return { ...result, apiPayload: buildApiPayload(payload, result.lines || []) };
}

export async function submitInventoryAdjustmentRequest(payload, preview) {
  const apiPayload = preview?.apiPayload || buildApiPayload(payload, preview?.lines || []);
  const result = await applySicarInventoryAdjustment(apiPayload);
  const request = {
    id: apiPayload.requestId,
    sessionId: apiPayload.requestId,
    folio: payload.folio || apiPayload.requestId,
    status: result.duplicate ? "duplicate" : "done",
    ainId: result.adjustment?.ain_id || null,
    processedAt: new Date().toISOString(),
    message: result.duplicate
      ? "Este levantamiento ya habia sido aplicado; no se duplico."
      : result.noChanges
        ? "El levantamiento no contiene diferencias."
        : `Ajuste aplicado en SICAR #${result.adjustment?.ain_id}.`,
    summary: result.summary,
  };
  return {
    ok: true,
    created: !result.duplicate,
    alreadySubmitted: Boolean(result.duplicate),
    requiresRetry: false,
    request,
  };
}
