const COMPANY_PROFILES = Object.freeze({
  granada: Object.freeze({
    identificador: "granada",
    empresa: "CARNES SAN MARTIN GRANADA",
    branchId: "CARNES SAN MARTIN GRANADA",
    branchAlias: "Granada",
    legacyBranchId: "Granada",
    authTarget: "inventario-sanmartin",
    operationalFirebaseTarget: "pedidosinterno-3c65d",
    inventoryFirebaseTarget: "inventario-sanmartin",
    modules: Object.freeze(["internos", "proveedores", "inventario"]),
    internalTransfers: true,
    allowedEmails: Object.freeze([
      "granada.inventory@sanmartinsr.com",
      "luis.s.97@hotmail.com",
    ]),
  }),
  nindiri: Object.freeze({
    identificador: "nindiri",
    empresa: "CARNES SAN MARTIN NINDIRI",
    branchId: "CARNES SAN MARTIN NINDIRI",
    branchAlias: "Nindiri",
    legacyBranchId: "Nindiri",
    authTarget: "inventario-sanmartin",
    operationalFirebaseTarget: "pedidosinterno-3c65d",
    inventoryFirebaseTarget: "inventario-sanmartin",
    modules: Object.freeze(["internos", "proveedores", "inventario"]),
    internalTransfers: true,
    allowedEmails: Object.freeze(["nindiri.inventory@sanmartinsr.com"]),
  }),
  amparito: Object.freeze({
    identificador: "amparito",
    empresa: "CARNES AMPARITO",
    branchId: "CARNES AMPARITO",
    branchAlias: "Carnes Amparito",
    legacyBranchId: "Carnes Amparito",
    authTarget: "inventario-sanmartin",
    operationalFirebaseTarget: null,
    inventoryFirebaseTarget: "inventario-sanmartin",
    modules: Object.freeze(["proveedores", "inventario"]),
    internalTransfers: false,
    allowedEmails: Object.freeze(["carnesamparito@carnesamparito.com"]),
  }),
  masaya: Object.freeze({
    identificador: "masaya",
    empresa: "CARNES SAN MARTIN MASAYA",
    branchId: "CARNES SAN MARTIN MASAYA",
    branchAlias: "Masaya",
    legacyBranchId: "Masaya",
    authTarget: "inventario-sanmartin",
    operationalFirebaseTarget: null,
    inventoryFirebaseTarget: "inventario-sanmartin",
    modules: Object.freeze(["proveedores", "inventario"]),
    internalTransfers: false,
    allowedEmails: Object.freeze(["masaya@csmmasaya.com"]),
  }),
});

const LOGIN_ALIASES = Object.freeze({
  granada: "granada.inventory@sanmartinsr.com",
  nindiri: "nindiri.inventory@sanmartinsr.com",
  carnesamparito: "carnesamparito@carnesamparito.com",
  amparito: "carnesamparito@carnesamparito.com",
  masaya: "masaya@csmmasaya.com",
});

function normalize(value = "") {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resolveOperationsLogin(value = "") {
  const normalized = normalize(value);
  return LOGIN_ALIASES[normalized] || normalized;
}

function getCompanyProfile(identifier = "") {
  return COMPANY_PROFILES[normalize(identifier)] || null;
}

function getCompanyProfileByBranch(branchId = "") {
  const normalized = normalize(branchId);
  return Object.values(COMPANY_PROFILES).find((profile) => normalize(profile.branchId) === normalized) || null;
}

function buildTrustedCompanyContext(authUser, authorization = {}) {
  if (!authUser?.uid || !authUser?.email) throw new Error("La sesion Firebase no es valida.");
  const branchId = authorization.branchId || authorization.companyBranchId;
  const profile = getCompanyProfileByBranch(branchId);
  if (!profile) throw new Error("El usuario no tiene una empresa autorizada en CSM Operaciones.");

  const email = normalize(authUser.email);
  if (!profile.allowedEmails.some((allowed) => normalize(allowed) === email)) {
    throw new Error("El usuario autenticado no corresponde a la empresa asignada.");
  }

  const claimedModules = Array.isArray(authorization.modules) ? authorization.modules : profile.modules;
  const modules = profile.modules.filter((module) => claimedModules.includes(module));
  const internalTransfers = profile.internalTransfers && authorization.internalTransfers !== false;
  if (internalTransfers && !modules.includes("internos")) modules.unshift("internos");

  return Object.freeze({
    ...profile,
    modules: Object.freeze([...modules]),
    internalTransfers,
    uid: authUser.uid,
    email: authUser.email,
  });
}

function companyCanUseModule(companyContext, module) {
  return Boolean(companyContext?.modules?.includes(module));
}

export {
  buildTrustedCompanyContext,
  companyCanUseModule,
  COMPANY_PROFILES,
  getCompanyProfile,
  getCompanyProfileByBranch,
  resolveOperationsLogin,
};
