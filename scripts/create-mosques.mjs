#!/usr/bin/env node
// Neue Gemeinden anlegen (Moschee + Settings, ohne Admin-User).
// Idempotent: existierende Slugs werden übersprungen.
// node scripts/create-mosques.mjs <pb-url> <pb-admin-email> <pb-admin-password>

const PB_URL = process.argv[2] || "http://91.98.142.128:8090";
const ADMIN_EMAIL = process.argv[3];
const ADMIN_PASSWORD = process.argv[4];

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Usage: node scripts/create-mosques.mjs <pb-url> <pb-admin-email> <pb-admin-password>");
  process.exit(1);
}

// Gemeinden, die angelegt werden sollen.
const MOSQUES = [
  {
    slug: "igmg-neu-ulm",
    name: "IGMG Neu-Ulm",
    city: "Neu-Ulm",
    latitude: 48.3974,
    longitude: 10.0119,
  },
  {
    slug: "ditib-erbach",
    name: "DITIB Erbach",
    city: "Erbach",
    latitude: 48.3331,
    longitude: 9.8895,
  },
  {
    slug: "ditib-laichingen",
    name: "DITIB Laichingen",
    city: "Laichingen",
    latitude: 48.4889,
    longitude: 9.6886,
  },
  {
    slug: "ditib-ditzingen",
    name: "DITIB Ditzingen",
    city: "Ditzingen",
    latitude: 48.8267,
    longitude: 9.0653,
  },
];

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

  for (const m of MOSQUES) {
    console.log("\n=== " + m.name + " (" + m.slug + ") ===");

    const { record: mosque, created: m1 } = await findOrCreate(
      "mosques",
      "slug = " + JSON.stringify(m.slug),
      {
        name: m.name,
        slug: m.slug,
        city: m.city,
        latitude: m.latitude,
        longitude: m.longitude,
        timezone: "Europe/Berlin",
        brand_primary_color: "#1d6b38",
        donation_provider: "stripe",
        public_enabled: true,
      }
    );
    console.log("Moschee: " + (m1 ? "Created" : "Exists") + " " + mosque.id);

    const { created: s1 } = await findOrCreate(
      "settings",
      "mosque_id = " + JSON.stringify(mosque.id),
      {
        mosque_id: mosque.id,
        prayer_provider: "aladhan",
        prayer_method: 13,
        mawaqit_mosque_id: "",
        ramadan_mode: false,
        ramadan_start: "",
        ramadan_end: "",
      }
    );
    console.log("Settings: " + (s1 ? "Created" : "Exists"));

    console.log("URL: https://" + m.slug + ".moschee.app");
  }

  console.log("\nFertig.");
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
