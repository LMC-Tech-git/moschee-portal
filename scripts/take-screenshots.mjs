/**
 * take-screenshots.mjs
 *
 * Takes screenshots of demo.moschee.app Madrasa pages for /anleitung.
 *
 * Usage:
 *   node scripts/take-screenshots.mjs
 *
 * Prerequisites:
 *   - npm install --save-dev puppeteer
 *   - demo.moschee.app must be reachable
 */

import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../public/screenshots");

const BASE_URL = "https://demo.moschee.app";
const ADMIN_EMAIL = "demo-admin@moschee.app";
const ADMIN_PASSWORD = "Demo1234!";
const MEMBER_EMAIL = "demo-member@moschee.app";
const MEMBER_PASSWORD = "Demo1234!";

const VIEWPORT = { width: 1280, height: 720 };

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Clear + type email
  const emailInput = await page.$('input[type="email"]');
  await emailInput.click({ clickCount: 3 });
  await emailInput.type(email);

  // Clear + type password
  const passwordInput = await page.$('input[type="password"]');
  await passwordInput.click({ clickCount: 3 });
  await passwordInput.type(password);

  // Submit
  const submitButton = await page.$('button[type="submit"]');
  await submitButton.click();

  // Wait for navigation
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
  // Extra wait for client-side hydration
  await delay(2000);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function screenshot(page, url, filename, options = {}) {
  console.log(`📸 ${filename} → ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
  await delay(options.extraDelay || 1500);

  // Dismiss "App installieren" popup if present
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const dismiss = btns.find((b) => b.textContent?.includes("Nicht jetzt"));
      if (dismiss) dismiss.click();
    });
    await delay(300);
  } catch {}

  // Click tab by text content
  if (options.clickTabText) {
    try {
      await page.evaluate((text) => {
        const triggers = Array.from(document.querySelectorAll('[role="tab"], button'));
        const tab = triggers.find((el) => el.textContent?.trim().includes(text));
        if (tab) tab.click();
      }, options.clickTabText);
      await delay(1500);
    } catch {
      console.log(`   ⚠️ Could not click tab "${options.clickTabText}"`);
    }
  }

  // Click any specific element to expand/reveal content
  if (options.clickSelector) {
    try {
      await page.click(options.clickSelector);
      await delay(800);
    } catch {
      console.log(`   ⚠️ Could not click ${options.clickSelector}`);
    }
  }

  // Scroll to specific position
  if (options.scrollTo) {
    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    }, options.scrollTo);
    await delay(500);
  }

  const outputPath = path.join(OUTPUT_DIR, `${filename}.png`);
  await page.screenshot({ path: outputPath, type: "png" });
  console.log(`   ✅ Saved ${outputPath}`);
}

async function main() {
  console.log("🚀 Starting screenshot capture...\n");

  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: VIEWPORT,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // --- Admin screenshots ---
    console.log("🔑 Logging in as admin...");
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // 1. Madrasa Settings Tab
    await screenshot(page, `${BASE_URL}/admin/settings`, "madrasa-settings", {
      extraDelay: 2000,
      clickTabText: "Madrasa",
    });

    // 2. Madrasa Students list
    await screenshot(page, `${BASE_URL}/admin/madrasa/schueler`, "madrasa-students", {
      extraDelay: 2000,
    });

    // 3. Madrasa Fees
    await screenshot(page, `${BASE_URL}/admin/madrasa/gebuehren`, "madrasa-fees", {
      extraDelay: 2000,
    });

    // 4. Madrasa Attendance (pick first course)
    // First get a course ID from madrasa page
    await page.goto(`${BASE_URL}/admin/madrasa`, { waitUntil: "networkidle2" });
    await delay(2000);

    // Try to find an attendance link
    const attendanceLink = await page.evaluate(() => {
      // Look for attendance icon links in the course table
      const links = Array.from(document.querySelectorAll("a[href*='/attendance']"));
      return links.length > 0 ? links[0].getAttribute("href") : null;
    });

    if (attendanceLink) {
      await screenshot(page, `${BASE_URL}${attendanceLink}`, "madrasa-attendance", {
        extraDelay: 2000,
      });
    } else {
      console.log("   ⚠️ No attendance link found, trying direct URL pattern...");
      // Fallback: take madrasa overview instead
      await screenshot(page, `${BASE_URL}/admin/madrasa`, "madrasa-attendance", {
        extraDelay: 2000,
      });
    }

    // --- Member screenshots ---
    console.log("\n🔑 Logging in as member...");
    // Clear cookies and login fresh
    await page.deleteCookie(...(await page.cookies()));
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);

    // 5. Member profile Madrasa tab
    await screenshot(page, `${BASE_URL}/member/profile`, "madrasa-parent", {
      extraDelay: 2000,
      // Try to click Madrasa tab
      clickSelector: '[value="madrasa"]',
    });

    console.log("\n✅ All screenshots done!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
