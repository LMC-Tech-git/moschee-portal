/**
 * Design Sprint 1 — Visual Improvements
 * 1. KPITile Upgrade
 * 2. globals.css: .card-base
 * 3. app/page.tsx: Feature-Card colors + Button hover-lift
 * 4. Header.tsx: Gradient avatar fallback
 */
const fs = require('fs');
const path = require('path');
const root = 'C:\\Users\\halim\\Documents\\cami-portal\\moschee-portal';
const r = (rel) => path.join(root, rel);

// ── 1. KPITile Upgrade ──────────────────────────────────────────────────────
{
  const content = [
    'interface KPITileProps {',
    '  icon: React.ReactNode;',
    '  label: string;',
    '  value: number | string;',
    '}',
    '',
    'export function KPITile({ icon, label, value }: KPITileProps) {',
    '  return (',
    '    <div',
    '      className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"',
    '      aria-label={`${label}: ${value}`}',
    '    >',
    '      <span className="rounded-lg bg-gray-50 p-2" aria-hidden="true">{icon}</span>',
    '      <p className="text-2xl font-bold tabular-nums text-gray-900 leading-none">{value}</p>',
    '      <p className="text-xs font-medium text-gray-500">{label}</p>',
    '    </div>',
    '  );',
    '}',
    '',
  ].join('\n');
  fs.writeFileSync(r('components/shared/KPITile.tsx'), content, 'utf8');
  process.stdout.write('OK: KPITile.tsx\n');
}

// ── 2. globals.css — .card-base + button improvements ───────────────────────
{
  const content = [
    '@tailwind base;',
    '@tailwind components;',
    '@tailwind utilities;',
    '',
    '@layer base {',
    '  :root {',
    '    --background: 0 0% 100%;',
    '    --foreground: 224 71.4% 4.1%;',
    '    --card: 0 0% 100%;',
    '    --card-foreground: 224 71.4% 4.1%;',
    '    --popover: 0 0% 100%;',
    '    --popover-foreground: 224 71.4% 4.1%;',
    '    --muted: 220 14.3% 95.9%;',
    '    --muted-foreground: 220 8.9% 46.1%;',
    '    --accent: 220 14.3% 95.9%;',
    '    --accent-foreground: 220.9 39.3% 11%;',
    '    --destructive: 0 84.2% 60.2%;',
    '    --destructive-foreground: 210 20% 98%;',
    '    --border: 220 13% 91%;',
    '    --input: 220 13% 91%;',
    '    --ring: 168 76% 29%;',
    '    --radius: 0.5rem;',
    '  }',
    '',
    '  html {',
    '    scroll-behavior: smooth;',
    '  }',
    '',
    '  body {',
    '    @apply bg-background text-foreground antialiased;',
    '  }',
    '',
    '  * {',
    '    @apply border-border;',
    '  }',
    '}',
    '',
    '@layer components {',
    '  /* Einheitliches Card-Pattern */\n  .card-base {',
    '    @apply rounded-2xl border border-gray-100 bg-white shadow-sm',
    '           transition-shadow duration-200 hover:shadow-md;',
    '  }',
    '',
    '  .btn-primary {',
    '    @apply inline-flex items-center justify-center rounded-lg bg-primary-500 px-6 py-3 text-sm font-semibold text-white',
    '           transition-all duration-200 hover:bg-primary-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
    '           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2;',
    '  }',
    '',
    '  .btn-secondary {',
    '    @apply inline-flex items-center justify-center rounded-lg bg-secondary-500 px-6 py-3 text-sm font-semibold text-white',
    '           transition-all duration-200 hover:bg-secondary-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
    '           focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2;',
    '  }',
    '',
    '  .btn-outline {',
    '    @apply inline-flex items-center justify-center rounded-lg border-2 border-primary-500 px-6 py-3 text-sm font-semibold text-primary-500',
    '           transition-all duration-200 hover:bg-primary-500 hover:text-white hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
    '           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2;',
    '  }',
    '}',
    '',
  ].join('\n');
  fs.writeFileSync(r('app/globals.css'), content, 'utf8');
  process.stdout.write('OK: globals.css\n');
}

// ── 3. app/page.tsx — Feature colors + button hover-lift ───────────────────
{
  let src = fs.readFileSync(r('app/page.tsx'), 'utf8');

  // 3a. Replace FEATURES array to add iconBg + iconColor
  const OLD_FEATURES = `const FEATURES = [
  {
    icon: Clock,
    title: "Gebetszeiten",
    description:
      "Automatische Gebetszeiten f\u00fcr Ihren Standort \u2014 t\u00e4glich aktuell, mit individuellen Feinabstimmungen.",
  },
  {
    icon: Bell,
    title: "Ank\u00fcndigungen",
    description:
      "Neuigkeiten und Beitr\u00e4ge direkt f\u00fcr Mitglieder und die \u00d6ffentlichkeit ver\u00f6ffentlichen.",
  },
  {
    icon: Calendar,
    title: "Veranstaltungen",
    description:
      "Events anlegen, Anmeldungen verwalten und Teilnehmerlisten exportieren.",
  },
  {
    icon: Heart,
    title: "Spendenkampagnen",
    description:
      "Transparente Fundraising-Seiten mit Echtzeit-Fortschritt und Online-Zahlung via Stripe.",
  },
  {
    icon: Users,
    title: "Mitgliederverwaltung",
    description:
      "Mitglieder einladen, Rollen vergeben und den \u00dcberblick behalten.",
  },
  {
    icon: BookOpen,
    title: "Madrasa",
    description:
      "Kurse, Sch\u00fcler, Anwesenheit und Geb\u00fchren \u2014 alles an einem Ort verwalten.",
  },
];`;

  const NEW_FEATURES = `const FEATURES = [
  {
    icon: Clock,
    title: "Gebetszeiten",
    description:
      "Automatische Gebetszeiten f\u00fcr Ihren Standort \u2014 t\u00e4glich aktuell, mit individuellen Feinabstimmungen.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    icon: Bell,
    title: "Ank\u00fcndigungen",
    description:
      "Neuigkeiten und Beitr\u00e4ge direkt f\u00fcr Mitglieder und die \u00d6ffentlichkeit ver\u00f6ffentlichen.",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    icon: Calendar,
    title: "Veranstaltungen",
    description:
      "Events anlegen, Anmeldungen verwalten und Teilnehmerlisten exportieren.",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    icon: Heart,
    title: "Spendenkampagnen",
    description:
      "Transparente Fundraising-Seiten mit Echtzeit-Fortschritt und Online-Zahlung via Stripe.",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    icon: Users,
    title: "Mitgliederverwaltung",
    description:
      "Mitglieder einladen, Rollen vergeben und den \u00dcberblick behalten.",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
  },
  {
    icon: BookOpen,
    title: "Madrasa",
    description:
      "Kurse, Sch\u00fcler, Anwesenheit und Geb\u00fchren \u2014 alles an einem Ort verwalten.",
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
  },
];`;

  if (src.includes(OLD_FEATURES)) {
    src = src.replace(OLD_FEATURES, NEW_FEATURES);
    process.stdout.write('OK: page.tsx FEATURES colors\n');
  } else {
    process.stderr.write('WARN: FEATURES block not matched (CRLF?), skipping\n');
  }

  // 3b. Feature card icon rendering
  const OLD_ICON_DIV = `                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                    <Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  </div>`;
  const NEW_ICON_DIV = `                  <div className={\`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl \${feature.iconBg}\`}>
                    <Icon className={\`h-5 w-5 \${feature.iconColor}\`} aria-hidden="true" />
                  </div>`;
  if (src.includes(OLD_ICON_DIV)) {
    src = src.replace(OLD_ICON_DIV, NEW_ICON_DIV);
    process.stdout.write('OK: page.tsx feature icon colors\n');
  } else {
    process.stderr.write('WARN: feature icon div not matched\n');
  }

  // 3c. Primary CTA button hover-lift
  const OLD_CTA_PRIMARY = `className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"`;
  const NEW_CTA_PRIMARY = `className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-base font-bold text-white shadow-sm transition-all duration-200 hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"`;
  if (src.includes(OLD_CTA_PRIMARY)) {
    src = src.replace(new RegExp(OLD_CTA_PRIMARY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), NEW_CTA_PRIMARY);
    process.stdout.write('OK: page.tsx primary CTA hover-lift\n');
  } else {
    process.stderr.write('WARN: primary CTA not matched\n');
  }

  // 3d. Secondary/outline CTA button hover-lift (Demo ansehen + Anmelden)
  const OLD_CTA_SECONDARY = `className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"`;
  const NEW_CTA_SECONDARY = `className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"`;
  const count = (src.match(new RegExp(OLD_CTA_SECONDARY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (count > 0) {
    src = src.replace(new RegExp(OLD_CTA_SECONDARY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), NEW_CTA_SECONDARY);
    process.stdout.write(`OK: page.tsx secondary CTAs hover-lift (${count}x)\n`);
  } else {
    process.stderr.write('WARN: secondary CTA not matched\n');
  }

  // 3e. Fix features map to use feature. instead of _
  const OLD_MAP = `{FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (`;
  if (!src.includes(OLD_MAP)) {
    process.stderr.write('WARN: features map signature different\n');
  }

  fs.writeFileSync(r('app/page.tsx'), src, 'utf8');
  process.stdout.write('OK: app/page.tsx saved\n');
}

// ── 4. Header.tsx — Gradient avatar fallback ─────────────────────────────────
{
  let src = fs.readFileSync(r('components/shared/Header.tsx'), 'utf8');

  // Add AVATAR_GRADIENTS constant before the component
  const GRADIENTS_CONST = `
const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-blue-400 to-indigo-600",
  "from-violet-400 to-purple-600",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-600",
  "from-teal-400 to-cyan-600",
  "from-sky-400 to-blue-600",
  "from-fuchsia-400 to-violet-600",
];

`;

  const BEFORE_COMPONENT = 'export default function Header() {';
  if (!src.includes('AVATAR_GRADIENTS')) {
    src = src.replace(BEFORE_COMPONENT, GRADIENTS_CONST + BEFORE_COMPONENT);
    process.stdout.write('OK: Header.tsx AVATAR_GRADIENTS added\n');
  } else {
    process.stdout.write('SKIP: AVATAR_GRADIENTS already present\n');
  }

  // Replace the avatar fallback
  const OLD_AVATAR = `          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600">
              <span className="text-lg font-bold text-white" aria-hidden="true">
                {mosque?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
          )}`;

  const NEW_AVATAR = `          ) : (
            <div
              className={\`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br \${
                AVATAR_GRADIENTS[(mosque?.id?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length]
              }\`}
            >
              <span className="text-base font-bold text-white" aria-hidden="true">
                {mosque?.name?.charAt(0)?.toUpperCase() ?? "M"}
              </span>
            </div>
          )}`;

  if (src.includes(OLD_AVATAR)) {
    src = src.replace(OLD_AVATAR, NEW_AVATAR);
    process.stdout.write('OK: Header.tsx gradient avatar\n');
  } else {
    process.stderr.write('WARN: Header avatar block not matched\n');
  }

  fs.writeFileSync(r('components/shared/Header.tsx'), src, 'utf8');
  process.stdout.write('OK: Header.tsx saved\n');
}

process.stdout.write('\n\u2705 Design Sprint 1 complete!\n');
