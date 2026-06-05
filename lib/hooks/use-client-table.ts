"use client";

import { useMemo, useState } from "react";
import type { SortDir } from "@/components/shared/SortableHeader";

export type SortValue = string | number | null | undefined;

/**
 * Kapselt Suche + klickbare Spaltensortierung für Listen, deren Daten
 * vollständig im Client vorliegen ("alles geladen"-Seiten).
 *
 * - `searchText(row)` liefert den durchsuchbaren Text einer Zeile (alle relevanten Spalten zusammengefügt).
 * - `sorters` mappt Spalten-Keys auf einen Vergleichswert (String → localeCompare "de", Zahl → numerisch).
 * - `toggleSort(field)` dreht die Richtung bei gleicher Spalte, sonst Default-Richtung.
 */
export function useClientTable<
  T,
  S extends Record<string, (row: T) => SortValue>,
>(
  rows: T[],
  opts: {
    searchText: (row: T) => string;
    sorters: S;
    initialField: keyof S & string;
    initialDir?: SortDir;
    /** Default-Richtung beim erstmaligen Klick auf eine Spalte. Default: numerisch = "desc", sonst "asc". */
    defaultDirFor?: (field: keyof S & string) => SortDir;
  }
) {
  type F = keyof S & string;
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<F>(opts.initialField);
  const [sortDir, setSortDir] = useState<SortDir>(opts.initialDir ?? "asc");

  function toggleSort(field: F) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(opts.defaultDirFor ? opts.defaultDirFor(field) : "asc");
    }
  }

  const q = search.trim().toLowerCase();

  const view = useMemo(() => {
    const filtered = q
      ? rows.filter((r) => opts.searchText(r).toLowerCase().includes(q))
      : rows;
    const sorter = opts.sorters[sortBy];
    const sorted = [...filtered].sort((a, b) => {
      const va = sorter(a);
      const vb = sorter(b);
      let cmp: number;
      if (typeof va === "number" || typeof vb === "number") {
        cmp = (Number(va) || 0) - (Number(vb) || 0);
      } else {
        cmp = String(va ?? "").localeCompare(String(vb ?? ""), "de");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sortBy, sortDir]);

  return { view, search, setSearch, sortBy, sortDir, toggleSort, isSearching: q.length > 0 };
}
