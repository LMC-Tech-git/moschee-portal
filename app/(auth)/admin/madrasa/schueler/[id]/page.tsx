"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, UserPlus, Trash2, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getStudentById, getParentCandidates } from "@/lib/actions/students";
import {
  getParentsOfStudent,
  linkParentToStudent,
  unlinkParentFromStudent,
} from "@/lib/actions/parent-child";
import type { Student, User as UserType } from "@/types";

interface ParentCandidate {
  id: string;
  name: string;
  phone: string;
  address: string;
}

// Hilfsfunktion: Datum formatieren
function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("de-DE");
  } catch {
    return dateStr;
  }
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { mosqueId } = useMosque();
  const { user } = useAuth();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [parents, setParents] = useState<UserType[]>([]);
  const [candidates, setCandidates] = useState<ParentCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    if (!mosqueId) return;
    setIsLoading(true);
    setError(null);

    const [studentRes, parentsRes, candidatesRes] = await Promise.all([
      getStudentById(studentId, mosqueId),
      getParentsOfStudent(mosqueId, studentId),
      getParentCandidates(mosqueId),
    ]);

    if (!studentRes.success || !studentRes.data) {
      setError("Schüler nicht gefunden");
      setIsLoading(false);
      return;
    }

    setStudent(studentRes.data);
    setParents(parentsRes.data ?? []);
    setCandidates(candidatesRes.data ?? []);
    setIsLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [mosqueId, studentId]);

  // Kandidaten filtern: bereits zugewiesene Eltern ausblenden
  const assignedIds = useMemo(() => new Set(parents.map((p) => p.id)), [parents]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (assignedIds.has(c.id)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.phone.includes(q);
    });
  }, [candidates, assignedIds, searchQuery]);

  async function handleAddParent(candidateId: string) {
    if (!mosqueId || !user) return;
    setIsAdding(true);
    setError(null);

    const res = await linkParentToStudent(mosqueId, user.id, candidateId, studentId);
    if (res.success) {
      setSearchQuery("");
      await loadData();
    } else {
      setError(res.error ?? "Fehler beim Hinzufügen");
    }
    setIsAdding(false);
  }

  async function handleRemoveParent(parentUserId: string) {
    if (!mosqueId || !user) return;
    setRemovingId(parentUserId);
    setError(null);

    const res = await unlinkParentFromStudent(mosqueId, user.id, parentUserId, studentId);
    if (res.success) {
      await loadData();
    } else {
      setError(res.error ?? "Fehler beim Entfernen");
    }
    setRemovingId(null);
  }

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <Link
          href="/admin/madrasa/schueler"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Schülerliste
        </Link>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!student) return null;

  const studentName = `${student.first_name} ${student.last_name}`.trim();

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/madrasa/schueler"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Schülerliste
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{studentName}</h1>
          <Badge variant={student.status === "active" ? "default" : "secondary"}>
            {student.status === "active" ? "Aktiv" : "Inaktiv"}
          </Badge>
        </div>
      </div>

      {/* Schüler-Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schüler-Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          {student.date_of_birth && (
            <div>
              <p className="text-muted-foreground">Geburtsdatum</p>
              <p>{formatDate(student.date_of_birth)}</p>
            </div>
          )}
          {student.gender && (
            <div>
              <p className="text-muted-foreground">Geschlecht</p>
              <p>{student.gender === "male" ? "Männlich" : "Weiblich"}</p>
            </div>
          )}
          {student.school_name && (
            <div>
              <p className="text-muted-foreground">Schule</p>
              <p>{student.school_name}</p>
            </div>
          )}
          {student.school_class && (
            <div>
              <p className="text-muted-foreground">Klasse</p>
              <p>{student.school_class}</p>
            </div>
          )}
          {student.notes && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Notizen</p>
              <p>{student.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Eltern-Verwaltung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Eltern
            {parents.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {parents.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Zugewiesene Eltern */}
          {parents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Eltern zugewiesen.
            </p>
          ) : (
            <div className="space-y-2">
              {parents.map((parent) => (
                <div
                  key={parent.id}
                  className="flex items-center justify-between p-3 rounded-md border bg-muted/30"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {`${parent.first_name} ${parent.last_name}`.trim() || parent.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{parent.email}</p>
                    {parent.phone && (
                      <p className="text-xs text-muted-foreground">{parent.phone}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveParent(parent.id)}
                    disabled={removingId === parent.id}
                    title="Elternteil entfernen"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Elternteil hinzufügen */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Elternteil hinzufügen</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name oder Telefon suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {searchQuery.trim() && (
              <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                {filteredCandidates.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    Keine Mitglieder gefunden
                  </p>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{candidate.name}</p>
                        {candidate.phone && (
                          <p className="text-xs text-muted-foreground">
                            {candidate.phone}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddParent(candidate.id)}
                        disabled={isAdding}
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        Hinzufügen
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
