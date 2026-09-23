export type AccessRole = "student" | "contributor" | "admin";
export type SyllabusLevel = "H1" | "H2" | "H3";
export type MigrationStatus = "ready" | "needs-repair" | "needs-review" | "rebuild";

export type Topic = {
  id: string;
  syllabusCode: string;
  levels: SyllabusLevel[];
  strand: string;
  name: string;
  availabilityLabel: "H1/H2" | "H2 only" | "H3 only" | "H1/H2/H3";
  coverageNote?: string;
  order: number;
};

export type SimulationSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  author?: string;
  levels: SyllabusLevel[];
  primaryTopicId: string;
  relatedTopicIds: string[];
  thumbnailUrl?: string;
  contentPath?: string;
  publishedVersion?: number;
  status: "migration" | "published" | "archived";
  migrationStatus: MigrationStatus;
  legacyUrl?: string;
  migrationNote?: string;
  migrationCredit?: "updated" | "rebuilt";
  managed?: boolean;
  currentVersionId?: string;
};
