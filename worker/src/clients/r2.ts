import fs from "node:fs/promises";
import crypto from "node:crypto";
import fetch from "node-fetch";

type Env = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function env(): Env {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("R2 env vars missing");
  }
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
  };
}

function hmac(k: Buffer | string, d: string) {
  return crypto.createHmac("sha256", k).update(d).digest();
}

function sign(opts: { method: "GET" | "PUT"; key: string; expiresInSeconds: number }) {
  const e = env();
  const host = `${e.accountId}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalUri = `/${e.bucket}/${opts.key.split("/").map(encodeURIComponent).join("/")}`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${e.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(opts.expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalQuery = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [opts.method, canonicalUri, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const kDate = hmac(`AWS4${e.secretAccessKey}`, dateStamp);
  const kSig = hmac(hmac(hmac(kDate, region), service), "aws4_request");
  const signature = crypto.createHmac("sha256", kSig).update(stringToSign).digest("hex");
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function presignGet(key: string, expiresInSeconds = 3600) {
  return sign({ method: "GET", key, expiresInSeconds });
}

export function presignPut(key: string, expiresInSeconds = 900) {
  return sign({ method: "PUT", key, expiresInSeconds });
}

export async function downloadFromR2(key: string, localPath: string) {
  const url = presignGet(key, 600);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`r2 GET ${key}: ${r.status}`);
  await fs.writeFile(localPath, Buffer.from(await r.arrayBuffer()));
}

export async function uploadToR2(localPath: string, key: string, contentType: string) {
  const url = presignPut(key, 900);
  const body = await fs.readFile(localPath);
  const r = await fetch(url, { method: "PUT", body, headers: { "content-type": contentType } });
  if (!r.ok) throw new Error(`r2 PUT ${key}: ${r.status} ${await r.text()}`);
}
