"use server";

/**
 * Server-seitige Auth Actions.
 *
 * Warum: Der Browser kann HTTP-Requests (PocketBase) von HTTPS-Seiten nicht
 * abschicken (Mixed Content Blocking). Alle PB-Auth-Aufrufe laufen daher
 * server-seitig über diese Actions.
 */

import PocketBase from "pocketbase";

function getPB(): PocketBase {
  const url =
    process.env.POCKETBASE_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL;
  if (!url) throw new Error("POCKETBASE_URL fehlt in der Konfiguration");
  return new PocketBase(url);
}

/** Serialisiert ein PocketBase Record zu einem reinen JSON-Objekt. */
function serializeRecord(record: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record));
}

export type AuthActionResult = {
  token: string;
  record: Record<string, unknown>;
};

/**
 * Meldet den User mit E-Mail + Passwort an.
 * Gibt Token + User-Record zurück → Client speichert via pb.authStore.save()
 */
export async function loginAction(
  email: string,
  password: string
): Promise<AuthActionResult> {
  const pb = getPB();
  const authData = await pb
    .collection("users")
    .authWithPassword(email, password);
  return {
    token: authData.token,
    record: serializeRecord(authData.record as unknown as Record<string, unknown>),
  };
}

/**
 * Registriert einen neuen User und meldet ihn direkt an.
 */
export async function registerAction(data: {
  email: string;
  password: string;
  passwordConfirm: string;
  first_name: string;
  last_name: string;
  member_no?: string;
  mosque_id: string;
}): Promise<AuthActionResult> {
  const pb = getPB();
  await pb.collection("users").create({
    email: data.email,
    password: data.password,
    passwordConfirm: data.passwordConfirm,
    first_name: data.first_name,
    last_name: data.last_name,
    full_name: `${data.first_name} ${data.last_name}`.trim(),
    member_no: data.member_no || "",
    membership_number: data.member_no || "-",
    mosque_id: data.mosque_id,
    status: "pending",
    role: "member",
  });
  return loginAction(data.email, data.password);
}

/**
 * Erneuert den Auth-Token (authRefresh) server-seitig.
 */
export async function refreshTokenAction(
  currentToken: string
): Promise<AuthActionResult> {
  const pb = getPB();
  pb.authStore.save(currentToken, null);
  const authData = await pb.collection("users").authRefresh();
  return {
    token: authData.token,
    record: serializeRecord(authData.record as unknown as Record<string, unknown>),
  };
}
