export const INVENTORY_ENTRY_COUNT = "count";
export const INVENTORY_ENTRY_SALE = "sale-subtraction";

export function roundInventoryQuantity(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000;
}

export function normalizeInventoryEntryType(value) {
  return value === INVENTORY_ENTRY_SALE ? INVENTORY_ENTRY_SALE : INVENTORY_ENTRY_COUNT;
}

export function aggregateInventoryCountLines(lines = []) {
  const totals = new Map();

  lines.forEach((line) => {
    if (line.countedExistence === "" || !Number.isFinite(Number(line.countedExistence))) return;

    const key = Number(line.articleId) || `${line.clave}`;
    const current = totals.get(key) || {
      articleId: Number(line.articleId),
      clave: line.clave,
      descripcion: line.descripcion,
      unidad: line.unidad,
      currentExistence: line.currentExistence === null ? null : Number(line.currentExistence),
      grossCounted: 0,
      salesSubtracted: 0,
      countedExistence: 0,
      countLines: 0,
      saleLines: 0,
      zones: [],
    };
    const quantity = Number(line.countedExistence);

    if (normalizeInventoryEntryType(line.entryType) === INVENTORY_ENTRY_SALE) {
      current.salesSubtracted = roundInventoryQuantity(current.salesSubtracted + quantity);
      current.saleLines += 1;
    } else {
      current.grossCounted = roundInventoryQuantity(current.grossCounted + quantity);
      current.countLines += 1;
    }

    current.countedExistence = roundInventoryQuantity(current.grossCounted - current.salesSubtracted);
    if (line.zona && !current.zones.includes(line.zona)) current.zones.push(line.zona);
    totals.set(key, current);
  });

  return [...totals.values()];
}

export function validateInventoryCountLines(lines = []) {
  const invalidLine = lines.find((line) => {
    if (line.countedExistence === "") return false;
    const quantity = Number(line.countedExistence);
    return !Number.isFinite(quantity) || quantity < 0;
  });
  if (invalidLine) {
    return {
      valid: false,
      message: `Revisa la cantidad de ${invalidLine.clave || invalidLine.descripcion || "un producto"}. Debe ser cero o mayor.`,
    };
  }

  const negativeTotal = aggregateInventoryCountLines(lines).find((line) => line.countedExistence < 0);
  if (negativeTotal) {
    return {
      valid: false,
      message: `Las ventas restadas de ${negativeTotal.clave} superan el conteo acumulado.`,
    };
  }

  return { valid: true, message: "" };
}
