import assert from "node:assert/strict";
import test from "node:test";

import {
  LEGACY_SICAR_PACKAGE_KEYS,
  filterSicarOperationalArticles,
  isSicarPackageArticle,
} from "./sicarArticleEligibility.mjs";

test("excluye todos los paquetes legacy identificados", () => {
  for (const clave of LEGACY_SICAR_PACKAGE_KEYS) {
    assert.equal(isSicarPackageArticle({ clave }), true, clave);
  }
});

test("excluye paquetes marcados como receta por SICAR", () => {
  assert.equal(isSicarPackageArticle({ clave: "NUEVO", receta: 1 }), true);
  assert.equal(isSicarPackageArticle({ clave: "NUEVO-2", receta: "1" }), true);
  assert.equal(isSicarPackageArticle({ clave: "NUEVO-3", esPaquete: true }), true);
});

test("conserva articulos operativos y no usa el nombre como criterio", () => {
  const articles = [
    { clave: "00015", descripcion: "IN ENTERA", receta: 0 },
    { clave: "BOLSA01", descripcion: "PAQUETE DE BOLSAS", receta: 0 },
    { clave: "000221", descripcion: "SELECT 2.9", receta: 0 },
    { clave: "RECETA01", descripcion: "COMBO", receta: 1 },
  ];

  assert.deepEqual(
    filterSicarOperationalArticles(articles).map((article) => article.clave),
    ["00015", "BOLSA01"],
  );
  assert.equal(articles.length, 4);
});
