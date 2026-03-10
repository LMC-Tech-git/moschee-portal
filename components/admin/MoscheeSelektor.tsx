"use client";

import { useEffect, useState } from "react";
import { Globe, ChevronDown, Check, Building2 } from "lucide-react";
import { getAllMosques, type MosqueOption } from "@/lib/actions/mosques";
import { useMosque } from "@/lib/mosque-context";

export function MoscheeSelektor() {
  const { mosque, setMosqueOverride, overrideMosqueId } = useMosque();
  const [mosques, setMosques] = useState<MosqueOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllMosques()
      .then(setMosques)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors"
        type="button"
      >
        <Globe className="h-3.5 w-3.5 text-purple-500 shrink-0" />
        <span className="flex-1 truncate text-gray-700 text-xs">
          {overrideMosqueId && mosque ? mosque.name : "Gemeinde wählen..."}
        </span>
        <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
            {/* Plattform-Übersicht Option */}
            <button
              onClick={() => {
                setMosqueOverride(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-purple-50 transition-colors border-b border-gray-100"
              type="button"
            >
              <Globe className="h-4 w-4 text-purple-500 shrink-0" />
              <span className="flex-1 text-left text-gray-700 font-medium text-xs">
                Plattform-Übersicht
              </span>
              {!overrideMosqueId && (
                <Check className="h-3.5 w-3.5 text-purple-600 shrink-0" />
              )}
            </button>

            {loading ? (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">
                Laden...
              </div>
            ) : mosques.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">
                Keine Gemeinden gefunden
              </div>
            ) : (
              mosques.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setMosqueOverride(m.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  type="button"
                >
                  <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-gray-800 text-xs font-medium truncate">
                      {m.name}
                    </div>
                    {m.city && (
                      <div className="text-gray-400 text-[11px] truncate">
                        {m.city}
                      </div>
                    )}
                  </div>
                  {overrideMosqueId === m.id && (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
