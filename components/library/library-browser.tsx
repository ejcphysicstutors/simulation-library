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

const topicSymbols: Record<string, string> = {
  "9478-quantities-measurement": "Δ",
  "9478-forces-moments": "F",
  "9478-motion-forces": "v",
  "9478-energy-fields": "E",
  "h3-frames-reference": "↔",
  "9478-projectile-motion": "↗",
  "9478-collisions": "⇄",
  "9478-circular-motion": "○",
  "9478-gravitational-fields": "g",
  "9478-oscillations": "∿",
  "h3-rotational-motion": "τ",
  "9478-wave-motion": "λ",
  "9478-superposition": "Σ",
  "9478-temperature-ideal-gases": "T",
  "9478-thermodynamic-systems": "Q",
  "9478-electric-fields": "E⃗",
  "h3-electric-magnetic-fields": "E×B",
  "9478-currents": "I",
  "9478-circuits": "R",
  "9478-electromagnetic-forces": "Fᴮ",
  "9478-electromagnetic-induction": "Φ",
  "9478-quantum-physics": "hν",
  "9478-nuclear-physics": "☢",
  "h3-special-relativity": "γ",
};

export function LibraryBrowser({ simulations, topics, isDemo }: Props) {
  const [level, setLevel] = useState<"All" | SyllabusLevel>("All");
  const [query, setQuery] = useState("");

  const filteredTopics = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return topics
      .filter((topic) => level === "All" || topic.levels.includes(level))
      .map((topic) => {
        const topicSimulations = simulations.filter(
          (simulation) =>
            simulation.primaryTopicId === topic.id &&
            (level === "All" || simulation.levels.includes(level)),
        );

        const topicText = `${topic.name} ${topic.strand}`.toLowerCase();
        const topicMatchesSearch = !normalisedQuery || topicText.includes(normalisedQuery);
        const matchingSimulations = normalisedQuery
          ? topicSimulations.filter((simulation) => {
              const searchText = `${simulation.title} ${simulation.description} ${simulation.author ?? ""}`.toLowerCase();
              return searchText.includes(normalisedQuery);
            })
          : topicSimulations;

        const visibleCount = topicMatchesSearch ? topicSimulations.length : matchingSimulations.length;
        const visible = !normalisedQuery || topicMatchesSearch || matchingSimulations.length > 0;

        return { topic, count: visibleCount, visible };
      })
      .filter((item) => item.visible);
  }, [level, query, simulations, topics]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filteredTopics>();
    filteredTopics.forEach((item) => {
      const current = groups.get(item.topic.strand) ?? [];
      current.push(item);
      groups.set(item.topic.strand, current);
    });
    return Array.from(groups.entries());
  }, [filteredTopics]);

  return (
    <>
      <section className="topic-library-toolbar" aria-label="Library filters">
        <div className="search-wrap">
          <label htmlFor="simulation-search">Search</label>
          <input
            id="simulation-search"
            className="library-search"
            type="search"
            placeholder="Search a topic, simulation or teacher"
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
                onClick={() => setLevel(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="topic-library-summary">
        <span>{simulations.length} simulations</span>
        {isDemo ? <span>Demo view</span> : null}
      </div>

      {grouped.length === 0 ? (
        <section className="empty-state">
          <h2>No matching topics.</h2>
          <p>Try another level or search term.</p>
        </section>
      ) : (
        <div className="topic-strand-list">
          {grouped.map(([strand, items]) => (
            <section className="topic-strand" key={strand}>
              <div className="topic-strand-heading">
                <h2>{strand}</h2>
                <span>{items.reduce((total, item) => total + item.count, 0)} simulations</span>
              </div>
              <div className="topic-grid-compact">
                {items.map(({ topic, count }) => {
                  const content = (
                    <>
                      <span className="topic-symbol" aria-hidden="true">{topicSymbols[topic.id] ?? "•"}</span>
                      <div className="topic-card-copy">
                        <strong>{topic.name}</strong>
                        <small>{topic.availabilityLabel}</small>
                      </div>
                      <div className="topic-count">
                        <strong>{count}</strong>
                        <span>{count === 1 ? "simulation" : "simulations"}</span>
                      </div>
                    </>
                  );

                  return count > 0 ? (
                    <Link className="topic-card-compact" href={`/library/topic/${topic.id}`} key={topic.id}>
                      {content}
                    </Link>
                  ) : (
                    <div className="topic-card-compact topic-card-empty" key={topic.id} aria-disabled="true">
                      {content}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
