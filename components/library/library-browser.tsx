"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { SimulationSummary, SyllabusLevel, Topic } from "@/lib/data/types";

type Props = {
  simulations: SimulationSummary[];
  topics: Topic[];
  isDemo: boolean;
};

const levelOptions: Array<"All" | SyllabusLevel> = ["All", "H1", "H2", "H3"];

const migrationLabels = {
  ready: "Ready",
  "needs-repair": "Repair needed",
  "needs-review": "Review needed",
  rebuild: "Rebuild needed"
} as const;

export function LibraryBrowser({ simulations, topics, isDemo }: Props) {
  const [level, setLevel] = useState<"All" | SyllabusLevel>("All");
  const [topicId, setTopicId] = useState("all");
  const [query, setQuery] = useState("");

  const topicById = useMemo(() => new Map(topics.map((topic) => [topic.id, topic])), [topics]);

  const filtered = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();
    return simulations.filter((simulation) => {
      const topic = topicById.get(simulation.primaryTopicId);
      const matchesLevel = level === "All" || simulation.levels.includes(level);
      const matchesTopic = topicId === "all" || simulation.primaryTopicId === topicId;
      const matchesQuery =
        !normalisedQuery ||
        simulation.title.toLowerCase().includes(normalisedQuery) ||
        simulation.description.toLowerCase().includes(normalisedQuery) ||
        simulation.author?.toLowerCase().includes(normalisedQuery) ||
        topic?.name.toLowerCase().includes(normalisedQuery) ||
        topic?.strand.toLowerCase().includes(normalisedQuery);
      return matchesLevel && matchesTopic && matchesQuery;
    });
  }, [level, query, simulations, topicById, topicId]);

  const availableTopics = useMemo(() => {
    if (level === "All") return topics;
    return topics.filter((topic) => topic.levels.includes(level));
  }, [level, topics]);

  return (
    <>
      <section className="library-toolbar" aria-label="Library filters">
        <div className="search-wrap">
          <label htmlFor="simulation-search">Search simulations</label>
          <input
            id="simulation-search"
            className="library-search"
            type="search"
            placeholder="Try ‘photoelectric’, ‘fields’ or an author name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div>
          <span className="filter-label">Level</span>
          <div className="level-pills" aria-label="Syllabus level filters">
            {levelOptions.map((option) => (
              <button
                type="button"
                className={`pill ${level === option ? "active" : ""}`}
                key={option}
                onClick={() => {
                  setLevel(option);
                  if (option !== "All" && !topics.find((topic) => topic.id === topicId)?.levels.includes(option)) {
                    setTopicId("all");
                  }
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="topic-filter-wrap">
          <label htmlFor="topic-filter">Topic</label>
          <select
            id="topic-filter"
            className="topic-select"
            value={topicId}
            onChange={(event) => setTopicId(event.target.value)}
          >
            <option value="all">All topics</option>
            {availableTopics.map((topic) => (
              <option value={topic.id} key={topic.id}>
                {topic.order}. {topic.name} ({topic.availabilityLabel})
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="result-summary">
        <strong>{filtered.length}</strong> {filtered.length === 1 ? "simulation" : "simulations"}
        {level !== "All" ? ` for ${level}` : ""}
        {isDemo ? " · demo view" : " · migration catalogue"}
      </div>

      {filtered.length === 0 ? (
        <section className="empty-state">
          <h2>No simulations match these filters.</h2>
          <p>Try another level, topic or search term.</p>
        </section>
      ) : (
        <div className="simulation-grid">
          {filtered.map((simulation) => {
            const topic = topicById.get(simulation.primaryTopicId);
            return (
              <Link className="simulation-card interactive-card" href={`/library/${simulation.slug}`} key={simulation.id}>
                <div className="card-visual">
                  <span>{topic ? `${topic.name} (${topic.availabilityLabel})` : "Physics"}</span>
                  <span className={`migration-chip migration-${simulation.migrationStatus}`}>
                    {simulation.status === "published" ? `Published · v${simulation.publishedVersion ?? 1}` : migrationLabels[simulation.migrationStatus]}
                  </span>
                </div>
                <div className="card-body">
                  <div className="level-row">
                    {simulation.levels.map((item) => <span key={item}>{item}</span>)}
                  </div>
                  <h2>{simulation.title}</h2>
                  <p>{simulation.description}</p>
                  <div className="card-footer-row">
                    <span className="topic-label compact">{topic?.strand} · {topic?.name} {topic ? `(${topic.availabilityLabel})` : ""}</span>
                    <span className="card-arrow" aria-hidden="true">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
