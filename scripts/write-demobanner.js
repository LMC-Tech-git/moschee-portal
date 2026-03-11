const fs = require('fs');

const dest = 'C:\\Users\\halim\\Documents\\cami-portal\\moschee-portal\\components\\shared\\DemoBanner.tsx';

const lines = [
  '"use client";',
  '',
  'import { AlertTriangle, ArrowLeft } from "lucide-react";',
  'import Link from "next/link";',
  'import { useAuth } from "@/lib/auth-context";',
  'import { isDemoMosque } from "@/lib/demo";',
  '',
  'export function DemoBanner() {',
  '  const { user } = useAuth();',
  '',
  '  if (!user || !isDemoMosque(user.mosque_id)) return null;',
  '',
  '  return (',
  '    <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">',
  '      <div className="flex items-center gap-2">',
  '        <AlertTriangle className="h-4 w-4 shrink-0" />',
  '        <span>',
  '          <strong>Demo-Modus</strong> \u2014 Alle Daten k\u00f6nnen jederzeit zur\u00fcckgesetzt werden.',
  '          Nutze die Zugangsdaten auf der Anmeldeseite zum Testen.',
  '        </span>',
  '      </div>',
  '      <Link',
  '        href="/"',
  '        className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"',
  '      >',
  '        <ArrowLeft className="h-3 w-3" />',
  '        Zur Startseite',
  '      </Link>',
  '    </div>',
  '  );',
  '}',
  '',
];

try {
  fs.writeFileSync(dest, lines.join('\n'), 'utf8');
  process.stdout.write('OK: ' + dest + '\n');
} catch (e) {
  process.stderr.write('ERROR: ' + e.message + '\n');
  process.exit(1);
}
