import test from "node:test";
import assert from "node:assert/strict";

import { runMysqlProcess } from "./mysqlProcess.mjs";

test("envia consultas grandes por stdin sin agregarlas a la linea de comandos", async () => {
  const sql = "SELECT 1;\n".repeat(10_000);
  const echoStdin = "let body='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>body+=c);process.stdin.on('end',()=>process.stdout.write(body));";
  const output = await runMysqlProcess({
    executable: process.execPath,
    args: ["-e", echoStdin],
    sql,
  });

  assert.ok(sql.length > 32_767);
  assert.equal(output, `${sql}\n`);
});

test("propaga el error del proceso mysql", async () => {
  const failProcess = "process.stdin.resume();process.stdin.on('end',()=>{process.stderr.write('consulta invalida');process.exit(2);});";

  await assert.rejects(
    runMysqlProcess({ executable: process.execPath, args: ["-e", failProcess], sql: "SELECT ERROR;" }),
    /consulta invalida/,
  );
});
