import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/register`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/impressum`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/agb`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/datenschutz`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];

  if (!pbUrl) return staticRoutes;

  try {
    const res = await fetch(
      `${pbUrl}/api/collections/mosques/records?fields=slug,updated&perPage=200&sort=slug`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return staticRoutes;

    const data = await res.json();
    const mosques: { slug: string; updated: string }[] = data.items || [];

    const mosqueRoutes: MetadataRoute.Sitemap = mosques.flatMap((mosque) => [
      {
        url: `${baseUrl}/${mosque.slug}`,
        lastModified: new Date(mosque.updated),
        changeFrequency: "daily",
        priority: 0.9,
      },
      {
        url: `${baseUrl}/${mosque.slug}/events`,
        lastModified: new Date(mosque.updated),
        changeFrequency: "daily",
        priority: 0.7,
      },
      {
        url: `${baseUrl}/${mosque.slug}/campaigns`,
        lastModified: new Date(mosque.updated),
        changeFrequency: "weekly",
        priority: 0.7,
      },
      {
        url: `${baseUrl}/${mosque.slug}/donate`,
        lastModified: new Date(mosque.updated),
        changeFrequency: "monthly",
        priority: 0.6,
      },
    ]);

    return [...staticRoutes, ...mosqueRoutes];
  } catch {
    return staticRoutes;
  }
}
