"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  type ParentWithRelation,
} from "@/lib/actions/parent-child";
import { RELATION_TYPES } from "@/lib/constants";
import type { RelationType } from "@/types";
import type { Student } from "@/types";

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
  const t = useTranslations("adminStudentDetail");
  const tL = useTranslations("labels");
  const { mosqueId } = useMosque();
  const { user } = useAuth();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [parents, setParents] = useState<ParentWithRelation[]>([]);
  const [candidates, setCandidates] = useState<ParentCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRelationType, setSelectedRelationType] = useState<RelationType | "">("");
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
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
      setError(t("notFound"));
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

  async function handleAddParent() {
    if (!mosqueId || !user || !pendingCandidateId || !selectedRelationType) return;
    setIsAdding(true);
    setError(null);

    const res = await linkParentToStudent(
      mosqueId,
      user.id,
      pendingCandidateId,
      studentId,
      selectedRelationType as RelationType
    );
    if (res.success) {
      setSearchQuery("");
      setPendingCandidateId(null);
      setSelectedRelationType("");
      await loadData();
    } else {
      setError(res.error ?? t("errorAdd"));
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
      setError(res.error ?? t("errorRemove"));
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
          {t("backLink")}
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
          {t("backLink")}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{studentName}</h1>
          <Badge variant={student.status === "active" ? "default" : "secondary"}>
            {tL(`student.status.${student.status}`)}
          </Badge>
        </div>
      </div>

      {/* Schüler-Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("cardInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          {student.date_of_birth && (
            <div>
              <p className="text-muted-foreground">{t("fieldDob")}</p>
              <p>{formatDate(student.date_of_birth)}</p>
            </div>
          )}
          {student.gender && (
            <div>
              <p className="text-muted-foreground">{t("fieldGender")}</p>
              <p>{student.gender === "male" ? t("genderMale") : t("genderFemale")}</p>
            </div>
          )}
          {student.school_name && (
            <div>
              <p className="text-muted-foreground">{t("fieldSchool")}</p>
              <p>{student.school_name}</p>
            </div>
          )}
          {student.school_class && (
            <div>
              <p className="text-muted-foreground">{t("fieldClass")}</p>
              <p>{student.school_class}</p>
            </div>
          )}
          {student.notes && (
            <div className="col-span-2">
              <p className="text-muted-foreground">{t("fieldNotes")}</p>
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
            {t("parentsTitle")}
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
              {t("noParents")}
            </p>
          ) : (
            <div className="space-y-2">
              {[...parents]
                .sort((a, b) => {
                  const order: RelationType[] = [
                    RELATION_TYPES.FATHER,
                    RELATION_TYPES.MOTHER,
                    RELATION_TYPES.GUARDIAN,
                    RELATION_TYPES.OTHER,
                  ];
                  return order.indexOf(a.relation_type) - order.indexOf(b.relation_type);
                })
                .map((parent) => {
                  const relationLabel: Record<string, string> = {
                    father: t("relationFather"),
                    mother: t("relationMother"),
                    guardian: t("relationGuardian"),
                    other: t("relationOther"),
                  };
                  return (
                    <div
                      key={parent.id}
                      className="flex items-center justify-between p-3 rounded-md border bg-muted/30"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {`${parent.first_name} ${parent.last_name}`.trim() || parent.email}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {relationLabel[parent.relation_type] ?? parent.relation_type}
                          </span>
                        </div>
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
                        title={t("removeParentTitle")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}

          <Separator />

          {/* Portal-Benutzer verknüpfen */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">{t("linkParentTitle")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("linkParentHint")}
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPendingCandidateId(null);
                  setSelectedRelationType("");
                }}
                className="pl-9"
              />
            </div>

            {searchQuery.trim() && (
              <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                {filteredCandidates.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    {t("noResults")}
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
                        onClick={() => {
                          setPendingCandidateId(candidate.id);
                          setSelectedRelationType("");
                        }}
                        disabled={isAdding}
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        {t("addButton")}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Relation type + confirm */}
            {pendingCandidateId && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-3">
                <p className="text-xs font-medium text-blue-800">
                  {(() => {
                    const c = candidates.find((x) => x.id === pendingCandidateId);
                    return c ? t("selectRelation", { name: c.name }) : t("selectRelationGeneric");
                  })()}
                </p>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={selectedRelationType}
                  onChange={(e) => setSelectedRelationType(e.target.value as RelationType | "")}
                >
                  <option value="">{t("selectPlaceholder")}</option>
                  <option value={RELATION_TYPES.FATHER}>{t("relationFather")}</option>
                  <option value={RELATION_TYPES.MOTHER}>{t("relationMother")}</option>
                  <option value={RELATION_TYPES.GUARDIAN}>{t("relationGuardian")}</option>
                  <option value={RELATION_TYPES.OTHER}>{t("relationOther")}</option>
                </select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddParent}
                    disabled={!selectedRelationType || isAdding}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    {t("confirmAddButton")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setPendingCandidateId(null); setSelectedRelationType(""); }}
                  >
                    {t("cancelButton")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
