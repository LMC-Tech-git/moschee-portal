#!/usr/bin/env node
// Einmalig: Halim-Moschee anlegen (halim.moschee.app)
// node scripts/create-mosque-halim.mjs <pb-url> <pb-admin-email> <pb-admin-password>

const PB_URL = process.argv[2] || "http://91.98.142.128:8090";
const ADMIN_EMAIL = process.argv[3];
const ADMIN_PASSWORD = process.argv[4];

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Usage: node scripts/create-mosque-halim.mjs <pb-url> <pb-admin-email> <pb-admin-password>");
  process.exit(1);
}

const SLUG = "halim";
const ADMIN_USER_EMAIL = "halimelmaci@gmx.de";
const ADMIN_USER_PASSWORD = "Halim" + Math.random().toString(36).slice(2, 10) + "!A1";

let authToken = "";

async function pbFetch(path, options = {}) {
  const url = PB_URL + "/api/" + path;
  const headers = {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: authToken } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && options.throwOnError !== false) {
    throw new Error("PB " + res.status + ": " + JSON.stringify(json));
  }
  return json;
}

async function authenticate() {
  console.log("Auth...");
  const data = await pbFetch("admins/auth-with-password", {
    method: "POST",
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    throwOnError: false,
  });
  if (data.token) {
    authToken = data.token;
  } else {
    const d2 = await pbFetch("collections/users/auth-with-password", {
      method: "POST",
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    authToken = d2.token;
  }
  console.log("OK");
}

async function findOrCreate(collection, filter, createData) {
  try {
    const res = await pbFetch(
      "collections/" + collection + "/records?filter=" + encodeURIComponent(filter) + "&perPage=1"
    );
    if (res.items && res.items.length > 0) {
      return { record: res.items[0], created: false };
    }
  } catch {}
  const rec = await pbFetch("collections/" + collection + "/records", {
    method: "POST",
    body: JSON.stringify(createData),
  });
  return { record: rec, created: true };
}

async function run() {
  await authenticate();

  console.log("\nMoschee...");
  const { record: mosque, created: m1 } = await findOrCreate(
    "mosques",
    "slug = " + JSON.stringify(SLUG),
    {
      name: "Halim Moschee",
      slug: SLUG,
      description: "Test-Gemeinde für Stripe Connect + SEPA produktiv.",
      city: "Ulm",
      address: "Schillerstraße 4, 89077 Ulm",
      email: ADMIN_USER_EMAIL,
      phone: "+49 731 0000000",
      latitude: 48.4011,
      longitude: 9.9876,
      timezone: "Europe/Berlin",
      brand_primary_color: "#1d6b38",
      donation_provider: "stripe",
      public_enabled: true,
    }
  );
  console.log((m1 ? "Created" : "Exists") + ": " + mosque.id);

  console.log("\nSettings...");
  const { created: s1 } = await findOrCreate(
    "settings",
    "mosque_id = " + JSON.stringify(mosque.id),
    {
      mosque_id: mosque.id,
      prayer_provider: "aladhan",
      prayer_method: 13,
      mawaqit_mosque_id: "",
      madrasa_enabled: true,
      madrasa_fees_enabled: true,
      madrasa_default_fee_cents: 1500,
      donation_enabled: true,
      events_enabled: true,
      posts_enabled: true,
      team_visibility: "public",
      contact_enabled: true,
      contact_email: ADMIN_USER_EMAIL,
      contact_notify_admin: true,
      contact_auto_reply: true,
    }
  );
  console.log(s1 ? "Created" : "Exists");

  console.log("\nAdmin-User...");
  const { record: user, created: u1 } = await findOrCreate(
    "users",
    "email = " + JSON.stringify(ADMIN_USER_EMAIL),
    {
      email: ADMIN_USER_EMAIL,
      password: ADMIN_USER_PASSWORD,
      passwordConfirm: ADMIN_USER_PASSWORD,
      emailVisibility: true,
      first_name: "Halim",
      last_name: "Elmaci",
      full_name: "Halim Elmaci",
      membership_number: "M-0001",
      member_no: "M-0001",
      mosque_id: mosque.id,
      role: "admin",
      status: "active",
    }
  );
  console.log((u1 ? "Created" : "Exists") + ": " + user.id);

  console.log("\n========================================");
  console.log("MOSCHEE-ID: " + mosque.id);
  console.log("URL:        https://" + SLUG + ".moschee.app");
  console.log("LOGIN:      https://" + SLUG + ".moschee.app/login");
  console.log("Email:      " + ADMIN_USER_EMAIL);
  if (u1) {
    console.log("Passwort:   " + ADMIN_USER_PASSWORD);
    console.log("(Initial-Passwort — bitte direkt ändern)");
  } else {
    console.log("Passwort:   (unverändert — User existierte schon)");
  }
  console.log("========================================");
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
