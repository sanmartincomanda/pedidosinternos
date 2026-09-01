// Legacy clients do not receive SICAR's `receta` flag. Keep these known package
// keys blocked until every branch has the updated local API installed.
export const LEGACY_SICAR_PACKAGE_KEYS = new Set([
  "001671",
  "000181",
  "000331",
  "000361",
  "000201",
  "000471",
  "000491",
  "000221",
  "000271",
  "000211",
  "000401",
  "001782",
  "000562",
  "000322",
  "CASERO2",
  "CASERO3",
  "CASERO4",
]);

function normalizeArticleKey(value) {
  return `${value || ""}`.trim().toUpperCase();
}

function isEnabledFlag(value) {
  if (value === true || value === 1) return true;
  const normalized = `${value ?? ""}`.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "si" || normalized === "yes";
}

export function isSicarPackageArticle(article) {
  if (!article || typeof article !== "object") return false;
  const key = normalizeArticleKey(article.clave || article.key || article.codigo);
  if (LEGACY_SICAR_PACKAGE_KEYS.has(key)) return true;

  return [
    article.receta,
    article.esReceta,
    article.isRecipe,
    article.paquete,
    article.esPaquete,
    article.isPackage,
  ].some(isEnabledFlag);
}

export function filterSicarOperationalArticles(articles) {
  if (!Array.isArray(articles)) return [];
  return articles.filter((article) => !isSicarPackageArticle(article));
}
