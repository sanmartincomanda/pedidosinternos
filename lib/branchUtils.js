const BRANCH_DEFINITIONS = [
  {
    id: "Granada",
    label: "Carnes San Martin Granada",
    shortName: "Granada",
    accounting: {
      branchId: "granada",
      branchCode: "GRANADA",
      branchName: "CARNES SAN MARTIN GRANADA",
      documentSeries: "A",
    },
    aliases: [
      "Granada",
      "Carnes San Martin Granada",
      "Sucursal Granada Serie A",
      "Granada Serie A",
      "Serie A",
      "Granada Gold",
    ],
    passwords: ["granada2026", "seriea2026"],
  },
  {
    id: "Nindiri",
    label: "Carnes San Martin Nindiri",
    shortName: "Nindiri",
    accounting: {
      branchId: "nindiri",
      branchCode: "NINDIRI",
      branchName: "CARNES SAN MARTIN NINDIRI",
      documentSeries: "B",
    },
    aliases: [
      "Nindiri",
      "Carnes San Martin Nindiri",
      "Sucursal Nindiri Serie B",
      "Nindiri Serie B",
      "Serie B",
    ],
    passwords: ["nindiri2026", "serieb2026"],
  },
];

function normalizeBranchValue(value = "") {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const BRANCH_BY_ID = new Map(BRANCH_DEFINITIONS.map((branch) => [branch.id, branch]));
const BRANCH_ALIAS_MAP = new Map();

BRANCH_DEFINITIONS.forEach((branch) => {
  branch.aliases.forEach((alias) => {
    BRANCH_ALIAS_MAP.set(normalizeBranchValue(alias), branch.id);
  });
  BRANCH_ALIAS_MAP.set(normalizeBranchValue(branch.id), branch.id);
  BRANCH_ALIAS_MAP.set(normalizeBranchValue(branch.label), branch.id);
});

function getCanonicalBranchId(value = "") {
  const fallback = `${value || ""}`.trim();
  const normalized = normalizeBranchValue(value);
  return BRANCH_ALIAS_MAP.get(normalized) || fallback;
}

function getBranchDisplayName(value = "") {
  const branchId = getCanonicalBranchId(value);
  return BRANCH_BY_ID.get(branchId)?.label || `${value || ""}`.trim();
}

function getBranchShortName(value = "") {
  const branchId = getCanonicalBranchId(value);
  return BRANCH_BY_ID.get(branchId)?.shortName || `${value || ""}`.trim();
}

function getBranchAccountingPayload(value = "") {
  const branchId = getCanonicalBranchId(value);
  const branch = BRANCH_BY_ID.get(branchId);

  if (!branch?.accounting) {
    const fallback = `${value || ""}`.trim();
    return {
      branchId: fallback.toLowerCase() || "",
      branchCode: fallback.toUpperCase() || "",
      branchName: fallback,
      documentSeries: "",
    };
  }

  return {
    ...branch.accounting,
  };
}

function isSameBranch(left = "", right = "") {
  const leftId = getCanonicalBranchId(left);
  const rightId = getCanonicalBranchId(right);
  return Boolean(leftId) && Boolean(rightId) && leftId === rightId;
}

function authenticateBranch(username = "", password = "") {
  const normalizedUsername = normalizeBranchValue(username);

  const branch = BRANCH_DEFINITIONS.find(
    (item) =>
      item.passwords.includes(password) &&
      item.aliases.some((alias) => normalizeBranchValue(alias) === normalizedUsername),
  );

  if (!branch) {
    return null;
  }

  return {
    id: branch.id,
    label: branch.label,
  };
}

function getSelectableBranches(excludeBranch = "") {
  const excludeId = getCanonicalBranchId(excludeBranch);
  return BRANCH_DEFINITIONS.map((branch) => branch.id).filter((branchId) => branchId !== excludeId);
}

export {
  authenticateBranch,
  BRANCH_DEFINITIONS,
  getBranchAccountingPayload,
  getBranchDisplayName,
  getCanonicalBranchId,
  getBranchShortName,
  getSelectableBranches,
  isSameBranch,
  normalizeBranchValue,
};
