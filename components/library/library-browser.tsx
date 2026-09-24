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

  const clearFilters = () => {
    setQuery("");
    setLevel("All");
    setTopicId("all");
  };

  const filtersActive = query.trim() !== "" || level !== "All" || topicId !== "all";

  return (
    <>
      <section className="student-library-controls" aria-label="Library filters">
        <div className="student-search-wrap">
          <label htmlFor="simulation-search">Search</label>
          <div className="student-search-field">
            <span aria-hidden="true">⌕</span>
            <input
              id="simulation-search"
              type="search"
              placeholder="Search a topic, idea or simulation…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="student-filter-row">
          <div className="student-level-filter">
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

          <div className="student-topic-filter">
            <label htmlFor="topic-filter">Topic</label>
            <select
              id="topic-filter"
              value={topicId}
              onChange={(event) => setTopicId(event.target.value)}
            >
              <option value="all">All topics</option>
              {availableTopics.map((topic) => (
                <option value={topic.id} key={topic.id}>
                  {topic.name} · {topic.availabilityLabel}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="student-results-bar">
        <p>
          <strong>{filtered.length}</strong> {filtered.length === 1 ? "simulation" : "simulations"}
          {level !== "All" ? ` for ${level}` : ""}
          {isDemo ? " · Demo access" : ""}
        </p>
        {filtersActive ? (
          <button type="button" className="clear-filters" onClick={clearFilters}>Clear filters</button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <section className="empty-state student-empty-state">
          <h2>No simulations found</h2>
          <p>Try a broader search or clear one of the filters.</p>
          <button type="button" className="button secondary" onClick={clearFilters}>Clear filters</button>
        </section>
      ) : (
        <div className="student-simulation-grid">
          {filtered.map((simulation) => {
            const topic = topicById.get(simulation.primaryTopicId);
            return (
              <Link className="student-simulation-card" href={`/library/${simulation.slug}`} key={simulation.id}>
                <div className="student-card-topline">
                  <span className="student-topic-chip">{topic?.name ?? "Physics"}</span>
                  <div className="student-level-badges" aria-label={`Levels: ${simulation.levels.join(", ")}`}>
                    {simulation.levels.map((item) => <span key={item}>{item}</span>)}
                  </div>
                </div>

                <div className="student-card-content">
                  <h2>{simulation.title}</h2>
                  <p>{simulation.description}</p>
                </div>

                <div className="student-card-footer">
                  <span className="student-card-author">
                    {simulation.author ? `By ${simulation.author}` : topic?.strand ?? "EJC Physics"}
                  </span>
                  <span className="student-open-link">Open <span aria-hidden="true">→</span></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
