import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const devServerUrl = "http://127.0.0.1:5173";

const projectPath = (...segments) => path.join(rootDir, ...segments);
const tscCli = projectPath("node_modules", "typescript", "bin", "tsc");
const viteCli = projectPath("node_modules", "vite", "bin", "vite.js");
const electronExecutable = isWindows
  ? projectPath("node_modules", "electron", "dist", "electron.exe")
  : projectPath("node_modules", "electron", "dist", "electron");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
      shell: false,
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${path.basename(command)} exited with code ${code}`));
    });
  });
}

function spawnLongRunning(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
    shell: false,
    ...options
  });

  child.on("error", (error) => {
    console.error(error);
  });

  return child;
}

async function waitForServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await canReach(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function canReach(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(true);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function stopProcess(child) {
  if (!child || child.killed) {
    return;
  }

  if (isWindows && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      shell: true
    });
    return;
  }

  child.kill("SIGTERM");
}

let viteProcess;

try {
  console.log("[JW Modbus Tool] Building Electron main and preload...");
  await run(process.execPath, [tscCli, "-p", "tsconfig.electron.json"]);
  await run(process.execPath, ["scripts/copy-preload.mjs"]);

  if (await canReach(devServerUrl)) {
    console.log("[JW Modbus Tool] Reusing existing Vite dev server.");
  } else {
    console.log("[JW Modbus Tool] Starting Vite dev server...");
    viteProcess = spawnLongRunning(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", "5173"]);
    await waitForServer(devServerUrl);
  }

  console.log("[JW Modbus Tool] Opening Electron...");
  await run(electronExecutable, ["."], {
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devServerUrl
    }
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  stopProcess(viteProcess);
}
