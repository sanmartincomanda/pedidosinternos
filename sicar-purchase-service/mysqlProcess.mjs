import { spawn } from "node:child_process";

export function runMysqlProcess({ executable, args = [], sql, env = process.env, spawnProcess = spawn }) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(executable, args, {
      windowsHide: true,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdin.on("error", fail);
    child.on("error", fail);
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `mysql.exe termino con codigo ${code}.`));
    });

    child.stdin.end(`${sql || ""}\n`, "utf8");
  });
}
