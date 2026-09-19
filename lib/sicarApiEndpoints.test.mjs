import assert from "node:assert/strict";
import test from "node:test";
import { buildSicarApiCandidates } from "./sicarApiEndpoints.mjs";

test("Granada web usa rutas HTTPS y descarta la IP HTTP", () => {
  const endpoints = buildSicarApiCandidates({
    companyKey: "granada",
    savedEndpoint: "http://192.168.1.137:43110",
    pageHostname: "traspasos.sanmartinsr.com",
    pageProtocol: "https:",
  });

  assert.deepEqual(endpoints, [
    "https://microsoft.tail95b6f5.ts.net:8443/granada-api",
    "https://microsoft.tail95b6f5.ts.net/granada-api",
    "https://microsoft.tail95b6f5.ts.net:8445",
  ]);
});

test("APK Granada conserva la ultima ruta y dispone de respaldos", () => {
  const endpoints = buildSicarApiCandidates({
    companyKey: "granada",
    savedEndpoint: "https://microsoft.tail95b6f5.ts.net:8445/",
    lastWorkingEndpoint: "http://192.168.1.137:43110",
    nativePlatform: true,
    pageProtocol: "https:",
  });

  assert.deepEqual(endpoints, [
    "http://192.168.1.137:43110",
    "https://microsoft.tail95b6f5.ts.net:8445",
    "https://microsoft.tail95b6f5.ts.net:8443/granada-api",
    "https://microsoft.tail95b6f5.ts.net/granada-api",
  ]);
});

test("elimina rutas duplicadas sin alterar el orden de prioridad", () => {
  const endpoints = buildSicarApiCandidates({
    companyKey: "granada",
    savedEndpoint: "https://microsoft.tail95b6f5.ts.net/granada-api/",
    lastWorkingEndpoint: "https://microsoft.tail95b6f5.ts.net/granada-api",
    pageHostname: "traspasos.sanmartinsr.com",
    pageProtocol: "https:",
  });

  assert.equal(
    endpoints.filter((value) => value === "https://microsoft.tail95b6f5.ts.net/granada-api").length,
    1,
  );
});
