import type { DatabaseConfig } from "@/lib/database-config";

const STORAGE_KEY = "uvi-space.db-config.v1";
const PASSPHRASE = "uvi-space-local-encryption-key";
const SALT = "informes-moodle-uvi";

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function getKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(PASSPHRASE),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(SALT),
      iterations: 120_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(payload: string) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const encodedPayload = new TextEncoder().encode(payload);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedPayload,
  );

  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

async function decrypt(payload: string) {
  const [ivBase64, encryptedBase64] = payload.split(".");

  if (!ivBase64 || !encryptedBase64) {
    throw new Error("Formato de payload cifrado inválido");
  }

  const key = await getKey();
  const iv = fromBase64(ivBase64);
  const encryptedBytes = fromBase64(encryptedBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedBytes,
  );

  return new TextDecoder().decode(decryptedBuffer);
}

export async function saveEncryptedDbConfig(config: DatabaseConfig) {
  const payload = JSON.stringify(config);
  const encryptedPayload = await encrypt(payload);
  localStorage.setItem(STORAGE_KEY, encryptedPayload);
}

export async function loadEncryptedDbConfig() {
  const encryptedPayload = localStorage.getItem(STORAGE_KEY);

  if (!encryptedPayload) {
    return null;
  }

  const payload = await decrypt(encryptedPayload);
  return JSON.parse(payload) as DatabaseConfig;
}

export function clearEncryptedDbConfig() {
  localStorage.removeItem(STORAGE_KEY);
}