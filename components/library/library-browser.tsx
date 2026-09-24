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

function TopicIcon({ topicId }: { topicId: string }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 22,
    height: 22,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (topicId) {
    case "9478-quantities-measurement":
      return <svg {...common}><path d="M4 18 18 4l2 2L6 20Z"/><path d="m8 16-2-2m5-1-2-2m5-1-2-2"/></svg>;
    case "9478-forces-moments":
      return <svg {...common}><path d="M12 3v17M5 7h14M7 7l-3 6h6Zm10 0-3 6h6Z"/><path d="M8 20h8"/></svg>;
    case "9478-motion-forces":
      return <svg {...common}><path d="M4 17h13M13 13l4 4-4 4"/><path d="M6 8h8M10 4l4 4-4 4"/></svg>;
    case "9478-energy-fields":
      return <svg {...common}><path d="m13 2-8 12h7l-1 8 8-12h-7Z"/></svg>;
    case "h3-frames-reference":
      return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="m15 9-2 5-5 2 2-5Z"/></svg>;
    case "9478-projectile-motion":
      return <svg {...common}><path d="M4 18c3-8 7-12 14-10"/><path d="m16 5 3 3-4 1"/><circle cx="5" cy="18" r="1"/></svg>;
    case "9478-collisions":
      return <svg {...common}><path d="M3 8h7M7 5l3 3-3 3M21 16h-7m3-3-3 3 3 3"/><circle cx="12" cy="12" r="2"/></svg>;
    case "9478-circular-motion":
      return <svg {...common}><path d="M18 7a8 8 0 1 1-2-2"/><path d="M18 3v4h-4"/></svg>;
    case "9478-gravitational-fields":
      return <svg {...common}><circle cx="10" cy="12" r="4"/><path d="M4 12c2-5 10-8 16-4M6 18c5 2 11 0 14-5"/><circle cx="19" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>;
    case "9478-oscillations":
      return <svg {...common}><path d="M3 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0"/></svg>;
    case "h3-rotational-motion":
      return <svg {...common}><path d="M18 7a8 8 0 1 0 1 8"/><path d="m18 3 .2 4-4-.2"/><circle cx="12" cy="12" r="2"/></svg>;
    case "9478-wave-motion":
      return <svg {...common}><path d="M3 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg>;
    case "9478-superposition":
      return <svg {...common}><path d="M3 9c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 15c2 3 4 3 6 0s4-3 6 0 4 3 6 0"/></svg>;
    case "9478-temperature-ideal-gases":
      return <svg {...common}><path d="M10 5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0Z"/><path d="M12 7v8"/></svg>;
    case "9478-thermodynamic-systems":
      return <svg {...common}><path d="M12 21c4 0 7-3 7-7 0-4-3-6-5-9 0 3-2 4-3 6-1-2-2-3-3-4 0 4-3 5-3 8 0 3 3 6 7 6Z"/></svg>;
    case "9478-electric-fields":
      return <svg {...common}><circle cx="12" cy="12" r="2.5"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5M5 5l3.5 3.5m7 7L19 19m0-14-3.5 3.5m-7 7L5 19"/></svg>;
    case "h3-electric-magnetic-fields":
      return <svg {...common}><path d="M5 5v8a7 7 0 0 0 14 0V5"/><path d="M5 5h5v4H5Zm9 0h5v4h-5Z"/><path d="M12 12h8m-3-3 3 3-3 3"/></svg>;
    case "9478-currents":
      return <svg {...common}><path d="M4 12h14M14 8l4 4-4 4"/><circle cx="6" cy="12" r="2"/></svg>;
    case "9478-circuits":
      return <svg {...common}><path d="M5 5h5v5H5Zm9 9h5v5h-5Z"/><path d="M10 7.5h4a3 3 0 0 1 3 3V14M14 16.5h-4a3 3 0 0 1-3-3V10"/></svg>;
    case "9478-electromagnetic-forces":
      return <svg {...common}><path d="M5 5v8a7 7 0 0 0 14 0V5"/><path d="M5 5h5v4H5Zm9 0h5v4h-5Z"/><path d="M12 12v8m-3-3 3 3 3-3"/></svg>;
    case "9478-electromagnetic-induction":
      return <svg {...common}><path d="M4 12h3c0-3 2-5 5-5s5 2 5 5h3M4 16h3c0-3 2-5 5-5s5 2 5 5h3"/><path d="m17 4 3 3-3 3"/></svg>;
    case "9478-quantum-physics":
      return <svg {...common}><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)"/></svg>;
    case "9478-nuclear-physics":
      return <svg {...common}><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M10.5 9A5 5 0 0 1 12 4l2.2 4M14.5 12a5 5 0 0 1 4.3 3l-4.5.2M10 13.5A5 5 0 0 1 6 16l2.3-4"/></svg>;
    case "h3-special-relativity":
      return <svg {...common}><circle cx="13" cy="12" r="7"/><path d="M13 8v4l3 2M3 7h4M2 12h4M3 17h4"/></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="7"/></svg>;
  }
}

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
                      <span className="topic-symbol"><TopicIcon topicId={topic.id} /></span>
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
