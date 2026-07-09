import { open, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const outputDirectory = path.join(projectRoot, "release");
const packageMetadata = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8")
);
const artifactPath = path.join(
  outputDirectory,
  `JW Modbus Tool-${packageMetadata.version}-x64.exe`
);
const intermediatePath = path.join(
  outputDirectory,
  `jw-modbus-tool-${packageMetadata.version}-x64.nsis.7z`
);
const builderCli = path.join(
  projectRoot,
  "node_modules",
  "electron-builder",
  "out",
  "cli",
  "cli.js"
);
const buildStartedAt = Date.now();

const exitCode = await runBuilder();

if (exitCode === 0) {
  console.log(`[JW Modbus Tool] Portable created: ${artifactPath}`);
  process.exit(0);
}

if (!(await isFreshPortableArtifact())) {
  process.exit(exitCode || 1);
}

console.warn(
  "[JW Modbus Tool] Portable created successfully; Windows blocked cleanup of the NSIS intermediate."
);
await removeIntermediateWithRetry();
console.log(`[JW Modbus Tool] Portable ready: ${artifactPath}`);

async function runBuilder() {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [builderCli, "--win", "portable"],
      {
        cwd: projectRoot,
        stdio: "inherit",
        windowsHide: true
      }
    );

    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function isFreshPortableArtifact() {
  try {
    const artifact = await stat(artifactPath);
    if (artifact.size < 1_000_000 || artifact.mtimeMs < buildStartedAt) {
      return false;
    }

    const handle = await open(artifactPath, "r");
    try {
      const signature = Buffer.alloc(2);
      await handle.read(signature, 0, signature.length, 0);
      return signature.toString("ascii") === "MZ";
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

async function removeIntermediateWithRetry() {
  if (!intermediatePath.startsWith(outputDirectory + path.sep)) {
    throw new Error("Refusing to remove an intermediate outside the release directory");
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await unlink(intermediatePath);
      return;
    } catch (error) {
      if (error?.code === "ENOENT") {
        return;
      }

      if (error?.code !== "EBUSY" && error?.code !== "EPERM") {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.warn(`[JW Modbus Tool] Intermediate remains locked: ${intermediatePath}`);
}
