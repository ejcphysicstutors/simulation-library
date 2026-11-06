"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type DragEvent, type FormEvent } from "react";

import type { SimulationSummary, SyllabusLevel, Topic } from "@/lib/data/types";
import type { SubmissionKind, SubmissionRecord } from "@/lib/submissions/types";

type Props = {
  topics: Topic[];
  simulations: SimulationSummary[];
  contributorName: string;
  editingSubmission?: SubmissionRecord;
};

const LEVELS: SyllabusLevel[] = ["H1", "H2", "H3"];

function topicLabel(topic: Topic) {
  return `${topic.name} (${topic.availabilityLabel})`;
}

export function SubmissionForm({ topics, simulations, contributorName, editingSubmission }: Props) {
  const router = useRouter();
  const revising = Boolean(editingSubmission);
  const [kind, setKind] = useState<SubmissionKind>(editingSubmission?.kind ?? "new");
  const [existingSimulationId, setExistingSimulationId] = useState(editingSubmission?.existingSimulationId ?? "");
  const initialSimulation = editingSubmission?.existingSimulationId
    ? simulations.find((item) => item.id === editingSubmission.existingSimulationId)
    : undefined;
  const [existingOwner, setExistingOwner] = useState(editingSubmission?.ownerName ?? initialSimulation?.author ?? "");
  const [ownerChoice, setOwnerChoice] = useState<"original" | "self">("original");
  const [title, setTitle] = useState(editingSubmission?.title ?? "");
  const [description, setDescription] = useState(editingSubmission?.description ?? "");
  const [levels, setLevels] = useState<SyllabusLevel[]>(editingSubmission?.levels ?? ["H2"]);
  const [primaryTopicId, setPrimaryTopicId] = useState(editingSubmission?.primaryTopicId ?? "");
  const [relatedTopicIds, setRelatedTopicIds] = useState<string[]>(editingSubmission?.relatedTopicIds ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");

  const availablePrimaryTopics = useMemo(
    () => topics.filter((topic) => levels.some((level) => topic.levels.includes(level))),
    [levels, topics],
  );

  function resetForNewKind(nextKind: SubmissionKind) {
    if (revising) return;
    setKind(nextKind);
    setExistingSimulationId("");
    setExistingOwner("");
    setOwnerChoice("original");
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
    setExistingOwner(simulation.author || "");
    setOwnerChoice("original");
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

  function chooseFile(nextFile: File | null) {
    setError("");
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setFile(null);
      setError("Simulation files must be 10 MB or smaller.");
      return;
    }
    if (!/\.(html?|zip)$/i.test(nextFile.name)) {
      setFile(null);
      setError("Upload a standalone HTML file or ZIP project.");
      return;
    }
    setFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!file) return setError(revising ? "Choose the corrected HTML file or ZIP project to resubmit." : "Choose a standalone HTML file or ZIP project.");
    if (file.size > 10 * 1024 * 1024) return setError("Simulation files must be 10 MB or smaller.");
    if (!/\.(html?|zip)$/i.test(file.name)) return setError("Upload a standalone HTML file or ZIP project.");
    if (!primaryTopicId) return setError("Choose a primary topic.");
    if (kind === "update" && !existingSimulationId) return setError("Choose the simulation you are updating.");

    const submissionId = editingSubmission?.submissionId ?? crypto.randomUUID();
    const metadata = {
      submissionId,
      kind,
      existingSimulationId: kind === "update" ? existingSimulationId : undefined,
      title,
      description,
      levels,
      primaryTopicId,
      relatedTopicIds,
      ownerName: kind === "update" && ownerChoice === "original" && existingOwner ? existingOwner : contributorName,
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
          revisionSubmissionId: editingSubmission?.submissionId,
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
        xhr.upload.onprogress = (uploadEvent) => {
          if (uploadEvent.lengthComputable) setProgress(Math.round((uploadEvent.loaded / uploadEvent.total) * 90));
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
      const completed = await completeResponse.json() as { error?: string; validation?: { errors: number; warnings: number } };
      if (!completeResponse.ok) throw new Error(completed.error || "The upload completed, but the submission could not be finalised.");

      if (completed.validation?.errors) {
        setSuccess(`Uploaded successfully. Automated checks found ${completed.validation.errors} issue${completed.validation.errors === 1 ? "" : "s"} that need attention before review.`);
      } else if (completed.validation?.warnings) {
        setSuccess(`Uploaded and checked. ${completed.validation.warnings} warning${completed.validation.warnings === 1 ? "" : "s"} will be shown to the reviewer.`);
      } else {
        setSuccess(revising ? "Changes resubmitted and checked successfully. It is now waiting for review." : "Uploaded and checked successfully. It is now waiting for review.");
      }
      setFile(null);
      setProgress(100);
      router.replace("/contribute");
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The upload could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="submission-form" className="submission-form" onSubmit={submit}>
      {revising ? (
        <div className="revision-banner">
          <div>
            <strong>{editingSubmission?.status === "rejected" ? "Edit and resubmit this submission" : "Make the requested changes"}</strong>
            <p>The existing submission record will be updated. Upload a corrected file and adjust any details below before resubmitting.</p>
            {editingSubmission?.adminNote ? <p className="revision-feedback"><strong>Reviewer feedback:</strong> {editingSubmission.adminNote}</p> : null}
          </div>
          <Link href="/contribute">Cancel</Link>
        </div>
      ) : null}

      <div className="submission-section">
        <div className="submission-section-heading">
          <span>1</span>
          <div><h2>What are you submitting?</h2><p>{revising ? "The original submission type is kept so the review history stays connected." : "Create something new or safely replace an existing simulation."}</p></div>
        </div>
        {revising ? (
          <div className="revision-kind-summary"><strong>{kind === "update" ? "Update existing simulation" : "New simulation"}</strong></div>
        ) : (
          <div className="segmented-control" role="group" aria-label="Submission type">
            <button type="button" className={kind === "new" ? "active" : ""} onClick={() => resetForNewKind("new")}>New simulation</button>
            <button type="button" className={kind === "update" ? "active" : ""} onClick={() => resetForNewKind("update")}>Update existing</button>
          </div>
        )}
        {kind === "update" ? (
          <>
            <label className="form-field">
              <span>Existing simulation</span>
              <select value={existingSimulationId} onChange={(event) => chooseExisting(event.target.value)} required disabled={revising}>
                <option value="">Choose a simulation…</option>
                {simulations.map((simulation) => <option key={simulation.id} value={simulation.id}>{simulation.title}</option>)}
              </select>
            </label>
            {existingSimulationId ? (
              <div className="owner-choice-card">
                <div><strong>Current owner</strong><span>{existingOwner || "Not recorded"}</span></div>
                {!revising ? (
                  <div className="owner-choice-options" role="group" aria-label="Owner for this update">
                    <label><input type="radio" name="ownerChoice" checked={ownerChoice === "original"} onChange={() => setOwnerChoice("original")} /> Keep original owner</label>
                    <label><input type="radio" name="ownerChoice" checked={ownerChoice === "self"} onChange={() => setOwnerChoice("self")} /> Change owner to {contributorName}</label>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
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
          <div><h2>{revising ? "Upload the corrected simulation" : "Upload the simulation"}</h2><p>One standalone HTML file or one ZIP project. Maximum 10 MB.</p></div>
        </div>
        <label
          className={`upload-box${dragActive ? " drag-active" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragLeave={(event) => { event.preventDefault(); if (event.currentTarget === event.target) setDragActive(false); }}
          onDrop={handleDrop}
        >
          <input type="file" accept=".html,.htm,.zip,text/html,application/zip" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
          <strong>{file ? file.name : "Choose or drag & drop HTML / ZIP"}</strong>
          <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Drop a file here, or click to browse. The system will determine how the simulation is packaged."}</span>
        </label>
        {busy || progress > 0 ? <div className="upload-progress"><div style={{ width: `${progress}%` }} /><span>{progress}%</span></div> : null}
      </div>

      {error ? <p className="submission-message error">{error}</p> : null}
      {success ? <p className="submission-message success">{success}</p> : null}
      <button className="button primary submit-simulation" type="submit" disabled={busy}>{busy ? "Uploading…" : revising ? "Resubmit for review" : "Submit for review"}</button>
    </form>
  );
}
