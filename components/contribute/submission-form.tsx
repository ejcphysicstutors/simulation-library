"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import type { SimulationSummary, SyllabusLevel, Topic } from "@/lib/data/types";
import type { SubmissionKind } from "@/lib/submissions/types";

type Props = {
  topics: Topic[];
  simulations: SimulationSummary[];
};

const LEVELS: SyllabusLevel[] = ["H1", "H2", "H3"];

function topicLabel(topic: Topic) {
  return `${topic.name} (${topic.availabilityLabel})`;
}

export function SubmissionForm({ topics, simulations }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<SubmissionKind>("new");
  const [existingSimulationId, setExistingSimulationId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [levels, setLevels] = useState<SyllabusLevel[]>(["H2"]);
  const [primaryTopicId, setPrimaryTopicId] = useState("");
  const [relatedTopicIds, setRelatedTopicIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");

  const availablePrimaryTopics = useMemo(
    () => topics.filter((topic) => levels.some((level) => topic.levels.includes(level))),
    [levels, topics],
  );

  function resetForNewKind(nextKind: SubmissionKind) {
    setKind(nextKind);
    setExistingSimulationId("");
    setTitle("");
    setDescription("");
    setLevels(["H2"]);
    setPrimaryTopicId("");
    setRelatedTopicIds([]);
    setFile(null);
    setError("");
    setSuccess("");
    setProgress(0);
  }

  function chooseExisting(id: string) {
    setExistingSimulationId(id);
    const simulation = simulations.find((item) => item.id === id);
    if (!simulation) return;
    setTitle(simulation.title);
    setDescription(simulation.description);
    setLevels(simulation.levels);
    setPrimaryTopicId(simulation.primaryTopicId);
    setRelatedTopicIds(simulation.relatedTopicIds);
  }

  function toggleLevel(level: SyllabusLevel) {
    setLevels((current) => {
      const next = current.includes(level) ? current.filter((item) => item !== level) : [...current, level];
      return next.length ? next : current;
    });
  }

  function toggleRelatedTopic(id: string) {
    setRelatedTopicIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.length < 5 ? [...current, id] : current,
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!file) return setError("Choose a standalone HTML file or ZIP project.");
    if (file.size > 10 * 1024 * 1024) return setError("Simulation files must be 10 MB or smaller.");
    if (!/\.(html?|zip)$/i.test(file.name)) return setError("Upload a standalone HTML file or ZIP project.");
    if (!primaryTopicId) return setError("Choose a primary topic.");
    if (kind === "update" && !existingSimulationId) return setError("Choose the simulation you are updating.");

    const submissionId = crypto.randomUUID();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(-140);
    const pathname = `submissions/${submissionId}/${safeFilename}`;

    const metadata = {
      submissionId,
      kind,
      existingSimulationId: kind === "update" ? existingSimulationId : undefined,
      title,
      description,
      levels,
      primaryTopicId,
      relatedTopicIds,
    };

    try {
      setBusy(true);
      setProgress(0);
      const prepareResponse = await fetch("/api/submissions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          metadata,
          originalFilename: file.name,
          fileSize: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });
      const prepared = await prepareResponse.json() as {
        error?: string;
        submissionId?: string;
        pathname?: string;
        presignedUrl?: string;
        contentType?: string;
      };
      if (!prepareResponse.ok || !prepared.presignedUrl || !prepared.submissionId || !prepared.pathname) {
        throw new Error(prepared.error || "The private upload URL could not be prepared.");
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", prepared.presignedUrl!, true);
        xhr.setRequestHeader("Content-Type", prepared.contentType || file.type || "application/octet-stream");
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 90));
        };
        xhr.onerror = () => reject(new Error("The file could not be uploaded to private storage."));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Private storage rejected the upload (${xhr.status}).`));
        };
        xhr.send(file);
      });

      setProgress(95);
      const completeResponse = await fetch("/api/submissions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          submissionId: prepared.submissionId,
          pathname: prepared.pathname,
        }),
      });
      const completed = await completeResponse.json() as { error?: string };
      if (!completeResponse.ok) throw new Error(completed.error || "The upload completed, but the submission could not be finalised.");

      setSuccess("Submitted successfully. It is now waiting for review.");
      setFile(null);
      setProgress(100);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The upload could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="submission-form" onSubmit={submit}>
      <div className="submission-section">
        <div className="submission-section-heading">
          <span>1</span>
          <div><h2>What are you submitting?</h2><p>Create something new or safely replace an existing simulation.</p></div>
        </div>
        <div className="segmented-control" role="group" aria-label="Submission type">
          <button type="button" className={kind === "new" ? "active" : ""} onClick={() => resetForNewKind("new")}>New simulation</button>
          <button type="button" className={kind === "update" ? "active" : ""} onClick={() => resetForNewKind("update")}>Update existing</button>
        </div>
        {kind === "update" ? (
          <label className="form-field">
            <span>Existing simulation</span>
            <select value={existingSimulationId} onChange={(event) => chooseExisting(event.target.value)} required>
              <option value="">Choose a simulation…</option>
              {simulations.map((simulation) => <option key={simulation.id} value={simulation.id}>{simulation.title}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      <div className="submission-section">
        <div className="submission-section-heading">
          <span>2</span>
          <div><h2>Describe it</h2><p>Use student-friendly wording. You can adjust this again during review.</p></div>
        </div>
        <label className="form-field"><span>Simulation title</span><input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required /></label>
        <label className="form-field"><span>Brief description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={20} maxLength={900} rows={4} required /></label>
      </div>

      <div className="submission-section">
        <div className="submission-section-heading">
          <span>3</span>
          <div><h2>Map it to the syllabus</h2><p>Choose the level(s) and the single best primary topic.</p></div>
        </div>
        <fieldset className="level-checks">
          <legend>Level(s)</legend>
          {LEVELS.map((level) => (
            <label key={level}><input type="checkbox" checked={levels.includes(level)} onChange={() => toggleLevel(level)} /> {level}</label>
          ))}
        </fieldset>
        <label className="form-field">
          <span>Primary topic</span>
          <select value={primaryTopicId} onChange={(event) => setPrimaryTopicId(event.target.value)} required>
            <option value="">Choose a topic…</option>
            {availablePrimaryTopics.map((topic) => <option key={topic.id} value={topic.id}>{topicLabel(topic)}</option>)}
          </select>
        </label>
        <details className="related-topics">
          <summary>Related topics <small>optional, up to 5</small></summary>
          <div className="related-topic-grid">
            {topics.filter((topic) => topic.id !== primaryTopicId).map((topic) => (
              <label key={topic.id}><input type="checkbox" checked={relatedTopicIds.includes(topic.id)} onChange={() => toggleRelatedTopic(topic.id)} /> {topicLabel(topic)}</label>
            ))}
          </div>
        </details>
      </div>

      <div className="submission-section">
        <div className="submission-section-heading">
          <span>4</span>
          <div><h2>Upload the simulation</h2><p>One standalone HTML file or one ZIP project. Maximum 10 MB.</p></div>
        </div>
        <label className="upload-box">
          <input type="file" accept=".html,.htm,.zip,text/html,application/zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <strong>{file ? file.name : "Choose HTML or ZIP"}</strong>
          <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "The system will determine how the simulation is packaged."}</span>
        </label>
        {busy || progress > 0 ? <div className="upload-progress"><div style={{ width: `${progress}%` }} /><span>{progress}%</span></div> : null}
      </div>

      {error ? <p className="submission-message error">{error}</p> : null}
      {success ? <p className="submission-message success">{success}</p> : null}
      <button className="button primary submit-simulation" type="submit" disabled={busy}>{busy ? "Uploading…" : "Submit for review"}</button>
    </form>
  );
}
