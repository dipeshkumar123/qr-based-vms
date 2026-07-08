import fs from "fs";

function readSecretFromFile(pathValue: string): string {
  const raw = fs.readFileSync(pathValue, "utf8");
  return raw.trim();
}

/**
 * Resolve secret from ENV_NAME or ENV_NAME_FILE (for Docker/K8s secret mounts).
 * Direct env takes precedence over file-based source.
 */
export function resolveSecret(envName: string): string {
  const direct = process.env[envName];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const fileRef = process.env[`${envName}_FILE`];
  if (typeof fileRef === "string" && fileRef.trim()) {
    try {
      return readSecretFromFile(fileRef.trim());
    } catch {
      return "";
    }
  }

  return "";
}
