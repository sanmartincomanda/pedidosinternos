export const SICAR_API_DEFAULT_PORT = 43110;

export const SICAR_API_ENDPOINTS_BY_COMPANY = Object.freeze({
  granada: Object.freeze([
    "https://microsoft.tail95b6f5.ts.net/granada-api",
    "https://microsoft.tail95b6f5.ts.net:8445",
    `http://192.168.1.137:${SICAR_API_DEFAULT_PORT}`,
  ]),
  masaya: Object.freeze([
    "https://servidor-masaya.tail95b6f5.ts.net",
  ]),
});

export function trimSicarApiEndpoint(value = "") {
  if (value === null || value === undefined) return "";
  return `${value}`.trim().replace(/\/+$/, "");
}

function uniqueEndpoints(values) {
  const seen = new Set();
  return values
    .map(trimSicarApiEndpoint)
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildSicarApiCandidates({
  companyKey = "",
  savedEndpoint = "",
  lastWorkingEndpoint = "",
  legacyEndpoint = "",
  nativePlatform = false,
  pageHostname = "",
  pageProtocol = "",
} = {}) {
  const normalizedCompany = `${companyKey}`.trim().toLowerCase();
  const localDevelopment = pageHostname === "localhost" || pageHostname === "127.0.0.1";
  const allowHttp = nativePlatform || pageProtocol !== "https:";
  const defaults = SICAR_API_ENDPOINTS_BY_COMPANY[normalizedCompany] || [];
  const localEndpoint = localDevelopment ? `http://127.0.0.1:${SICAR_API_DEFAULT_PORT}` : "";
  const genericFallback = defaults.length === 0 ? `http://192.168.1.137:${SICAR_API_DEFAULT_PORT}` : "";

  return uniqueEndpoints([
    lastWorkingEndpoint,
    savedEndpoint,
    localEndpoint,
    ...defaults,
    legacyEndpoint,
    genericFallback,
  ]).filter((endpoint) => allowHttp || !endpoint.toLowerCase().startsWith("http://"));
}
