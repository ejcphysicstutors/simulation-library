export type AccessRole = "student" | "contributor" | "admin";
export type SyllabusLevel = "H1" | "H2" | "H3";

export type Topic = {
  id: string;
  syllabusCode: string;
  level: SyllabusLevel;
  strand: string;
  name: string;
  order: number;
};

export type SimulationSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  levels: SyllabusLevel[];
  primaryTopicId: string;
  relatedTopicIds: string[];
  thumbnailUrl?: string;
  status: "published" | "archived";
};
