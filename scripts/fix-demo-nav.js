const fs = require('fs');
const path = require('path');
const root = 'C:\\Users\\halim\\Documents\\cami-portal\\moschee-portal';

// ── 1. app/page.tsx — noredirect skip-check ────────────────────────────────
{
  const file = path.join(root, 'app', 'page.tsx');
  let src = fs.readFileSync(file, 'utf8');
  const OLD = `  // Eingeloggte User → automatisch zum Moschee-Dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.mosque_id) {`;
  const NEW = `  // Eingeloggte User → automatisch zum Moschee-Dashboard
  // Ausnahme: ?noredirect=1 (z.B. vom Demo-Banner "← Zur Startseite")
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("noredirect=1")) return;
    if (!isLoading && isAuthenticated && user?.mosque_id) {`;
  if (src.includes(OLD)) {
    fs.writeFileSync(file, src.replace(OLD, NEW), 'utf8');
    process.stdout.write('OK: app/page.tsx\n');
  } else {
    process.stderr.write('SKIP (already patched?): app/page.tsx\n');
  }
}

// ── 2. components/shared/DemoBanner.tsx — href="/?noredirect=1" ────────────
{
  const file = path.join(root, 'components', 'shared', 'DemoBanner.tsx');
  let src = fs.readFileSync(file, 'utf8');
  const OLD = `        href="/"`;
  const NEW = `        href="/?noredirect=1"`;
  if (src.includes(OLD)) {
    fs.writeFileSync(file, src.replace(OLD, NEW), 'utf8');
    process.stdout.write('OK: DemoBanner.tsx\n');
  } else {
    process.stderr.write('SKIP (already patched?): DemoBanner.tsx\n');
  }
}

// ── 3. app/[slug]/layout.tsx — Demo-Banner für öffentliche Seite ───────────
{
  const file = path.join(root, 'app', '[slug]', 'layout.tsx');
  let src = fs.readFileSync(file, 'utf8');

  // Add isDemoMosque check + banner before return
  const OLD_RETURN = `  return (
    <div
      data-mosque-id={mosque.id}
      data-mosque-slug={mosque.slug}
      style={
        {
          "--brand-primary": primaryColor,
          "--brand-accent": accentColor,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );`;

  const NEW_RETURN = `  const isDemoBanner =
    process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID !== "" &&
    mosque.id === process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID;

  return (
    <div
      data-mosque-id={mosque.id}
      data-mosque-slug={mosque.slug}
      style={
        {
          "--brand-primary": primaryColor,
          "--brand-accent": accentColor,
        } as React.CSSProperties
      }
    >
      {isDemoBanner && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <span>
              &#x26A0;&#xFE0F; <strong>Demo-Modus</strong> \u2014 Alle Daten k\u00f6nnen jederzeit zur\u00fcckgesetzt werden.
            </span>
          </div>
          <a
            href="/?noredirect=1"
            className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
          >
            \u2190 Zur Startseite
          </a>
        </div>
      )}
      {children}
    </div>
  );`;

  if (src.includes(OLD_RETURN)) {
    fs.writeFileSync(file, src.replace(OLD_RETURN, NEW_RETURN), 'utf8');
    process.stdout.write('OK: app/[slug]/layout.tsx\n');
  } else {
    process.stderr.write('SKIP (already patched?): app/[slug]/layout.tsx\n');
    // Show a snippet of what's in the file for debugging
    process.stderr.write('File snippet:\n' + src.slice(1000, 1500) + '\n');
  }
}
