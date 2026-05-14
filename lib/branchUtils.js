const BRANCH_DEFINITIONS = [
  {
    id: "Granada Gold",
    label: "Granada Gold",
    aliases: ["Granada Gold"],
    passwords: ["granada2026"],
  },
  {
    id: "Masaya Gold",
    label: "Masaya Gold",
    aliases: ["Masaya Gold"],
    passwords: ["masaya2026"],
  },
  {
    id: "Cedi",
    label: "Carnes Amparito - CEDI",
    aliases: ["Cedi", "Carnes Amparito", "Carnes Amparito - CEDI"],
    passwords: ["cedi2026", "amparito2026"],
  },
  {
    id: "Luis Saenz",
    label: "Luis Saenz",
    aliases: ["Luis Saenz"],
    passwords: ["admin123"],
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
  getBranchDisplayName,
  getCanonicalBranchId,
  getSelectableBranches,
  isSameBranch,
  normalizeBranchValue,
};
