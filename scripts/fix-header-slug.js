const fs = require('fs');
const file = 'C:\\Users\\halim\\Documents\\cami-portal\\moschee-portal\\components\\shared\\Header.tsx';

let src = fs.readFileSync(file, 'utf8');

// 1. Add usePathname import after "next/link"
const OLD_IMPORT = 'import Link from "next/link";';
const NEW_IMPORT = 'import Link from "next/link";\nimport { usePathname } from "next/navigation";';

if (!src.includes('usePathname')) {
  src = src.replace(OLD_IMPORT, NEW_IMPORT);
  process.stdout.write('OK: added usePathname import\n');
} else {
  process.stdout.write('SKIP: usePathname already imported\n');
}

// 2. Add pathname inside component + fix slug derivation
// Find: const { user, isAuthenticated, logout } = useAuth();
// And:  const { mosque } = useMosque();
// Then: const isAdmin = ...
// Then: const slug = mosque?.slug;   ← this needs to change
const OLD_SLUG_BLOCK = `  const { user, isAuthenticated, logout } = useAuth();
  const { mosque } = useMosque();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "editor";
  const isSuperAdmin = user?.role === "super_admin";
  const isEditor = user?.role === "editor";
  const isTeacher = user?.role === "teacher";
  const isImam = user?.role === "imam";
  const slug = mosque?.slug;`;

const NEW_SLUG_BLOCK = `  const { user, isAuthenticated, logout } = useAuth();
  const { mosque } = useMosque();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "editor";
  const isSuperAdmin = user?.role === "super_admin";
  const isEditor = user?.role === "editor";
  const isTeacher = user?.role === "teacher";
  const isImam = user?.role === "imam";
  // URL-Slug hat Vorrang auf \u00f6ffentlichen Moschee-Seiten (verhindert falsche Links bei eingeloggten Usern)
  const HEADER_RESERVED = ['admin','member','lehrer','imam','login','register','api','invite'];
  const pathParts = pathname.split('/').filter(Boolean);
  const urlSlug = pathParts.length > 0 && !HEADER_RESERVED.includes(pathParts[0]) ? pathParts[0] : null;
  const slug = urlSlug ?? mosque?.slug;`;

if (src.includes(OLD_SLUG_BLOCK)) {
  src = src.replace(OLD_SLUG_BLOCK, NEW_SLUG_BLOCK);
  process.stdout.write('OK: slug derivation updated\n');
} else {
  process.stderr.write('ERROR: slug block not found — check for CRLF or whitespace differences\n');
  // debug: print the relevant section
  const idx = src.indexOf('const slug = mosque?.slug');
  if (idx !== -1) {
    process.stderr.write('Found at index: ' + idx + '\n');
    process.stderr.write(src.slice(idx - 300, idx + 50) + '\n');
  }
  process.exit(1);
}

fs.writeFileSync(file, src, 'utf8');
process.stdout.write('OK: Header.tsx saved\n');
