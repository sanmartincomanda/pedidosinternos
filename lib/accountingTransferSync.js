import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { accountingDb } from "@/firebase";
import { getBranchAccountingPayload } from "@/lib/branchUtils";
import {
  getItemLineCost,
  getItemUnitCost,
  getPhysicalReceiverId,
  getPhysicalSenderId,
  getRealQuantity,
} from "@/lib/historialUtils";
import { formatOrderNumber } from "@/lib/orderUtils";

const TRANSFER_COLLECTION = "traspasos_costos_sucursal";
const DEFAULT_CATEGORY = "Costos de venta / compras";
const DEFAULT_SUBCATEGORY = "Traspasos entre sucursales";

function safeNumber(value) {
  const normalized = `${value ?? ""}`.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((safeNumber(value) + Number.EPSILON) * factor) / factor;
}

function getRequestedQuantity(item = {}) {
  return safeNumber(item?.cantidad);
}

function buildAccountingItems(pedido) {
  return (Array.isArray(pedido?.items) ? pedido.items : [])
    .map((item) => {
      const requestedQuantity = roundTo(getRequestedQuantity(item), 4);
      const realQuantity = roundTo(getRealQuantity(item, pedido), 4);
      const quantityPreview = realQuantity > 0 ? realQuantity : requestedQuantity;
      const unitCost = getItemUnitCost(item, pedido);
      const lineCost = getItemLineCost(item, pedido);

      if (!item?.clave && !item?.producto && quantityPreview <= 0) {
        return null;
      }

      return {
        clave: item?.clave || "",
        descripcion: item?.producto || "",
        producto: item?.producto || "",
        cantidad: requestedQuantity,
        pesoReal: realQuantity,
        quantityPreview,
        unidad: `${item?.unidad || "lb"}`.trim().toUpperCase(),
        nota: item?.nota || "",
        costoUnitarioSicar: unitCost ?? null,
        totalCostoSicar: lineCost ?? null,
      };
    })
    .filter(Boolean);
}

function resolveTopLevelAmount(pedido, items) {
  const lineTotal = roundTo(items.reduce((sum, item) => sum + safeNumber(item.totalCostoSicar), 0), 2);
  if (lineTotal > 0) {
    return lineTotal;
  }

  const fallbackCandidates = [
    pedido?.totalCost,
    pedido?.totalCostoSicar,
    pedido?.montoMonetarioSicar,
    pedido?.amount,
    pedido?.monto,
  ];

  for (const candidate of fallbackCandidates) {
    const parsed = roundTo(candidate, 2);
    if (parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

function buildAccountingTransferPayload(pedido) {
  const fromBranch = getBranchAccountingPayload(getPhysicalSenderId(pedido));
  const toBranch = getBranchAccountingPayload(getPhysicalReceiverId(pedido));
  const items = buildAccountingItems(pedido);
  const date = `${pedido?.fechaEntrega || pedido?.fechaPedido || new Date().toISOString().slice(0, 10)}`.slice(0, 10);
  const reference = formatOrderNumber(pedido);
  const amount = resolveTopLevelAmount(pedido, items);
  const totalWeightRequested = roundTo(items.reduce((sum, item) => sum + safeNumber(item.quantityPreview), 0), 4);
  const totalWeightResolved = roundTo(items.reduce((sum, item) => sum + safeNumber(item.pesoReal), 0), 4);

  return {
    date,
    month: date.slice(0, 7),
    reference,
    description: `${pedido?.notaGeneral || ""}`.trim() || `Pedido ${reference}`,
    deliveryName: `${pedido?.enviadoCon || pedido?.preparadoPor || ""}`.trim(),
    receivedName: `${pedido?.recibidoPor || ""}`.trim(),
    amount,
    totalWeightRequested,
    totalWeightResolved,
    totalLineItems: items.length,
    items,
    category: DEFAULT_CATEGORY,
    categoria: DEFAULT_CATEGORY,
    subcategory: DEFAULT_SUBCATEGORY,
    subcategoria: DEFAULT_SUBCATEGORY,
    expenseCategory: DEFAULT_CATEGORY,
    expenseSubcategory: DEFAULT_SUBCATEGORY,
    fromBranchId: fromBranch.branchId,
    fromBranchCode: fromBranch.branchCode,
    fromBranchName: fromBranch.branchName,
    fromDocumentSeries: fromBranch.documentSeries,
    toBranchId: toBranch.branchId,
    toBranchCode: toBranch.branchCode,
    toBranchName: toBranch.branchName,
    toDocumentSeries: toBranch.documentSeries,
    source: "pedidosinternos",
    sourceType: pedido?.tipoPedido === "VACUNA" ? "pedidos_internos_vacuna" : "pedidos_internos",
    status: "activo",
    operationalStatus: amount > 0 ? "ready" : "pendiente_sicar",
    integrationStatus: amount > 0 ? "ready" : "pending",
    accountingStatus: amount > 0 ? "ready" : "pending",
    sourceOrderId: reference,
    sourceFirebaseId: pedido?.firebaseId || "",
    sourceProjectId: "pedidosinterno-3c65d",
    pedidoSucursalOrigen: pedido?.sucursalOrigen || "",
    pedidoSucursalDestino: pedido?.sucursalDestino || "",
    pedidoTipo: pedido?.tipoPedido || "TRASPASO",
  };
}

async function syncPedidoToAccounting(pedido, mirrorId = "") {
  const payload = buildAccountingTransferPayload(pedido);

  if (!payload.sourceOrderId) {
    return { status: "skipped", mirrorId: mirrorId || "", syncedAt: new Date().toISOString() };
  }

  if (mirrorId) {
    await updateDoc(doc(accountingDb, TRANSFER_COLLECTION, mirrorId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });

    return {
      status: "synced",
      mirrorId,
      syncedAt: new Date().toISOString(),
      amount: payload.amount,
    };
  }

  const created = await addDoc(collection(accountingDb, TRANSFER_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    status: "synced",
    mirrorId: created.id,
    syncedAt: new Date().toISOString(),
    amount: payload.amount,
  };
}

export { buildAccountingTransferPayload, syncPedidoToAccounting };
