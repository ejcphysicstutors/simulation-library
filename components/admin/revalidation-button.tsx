"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevalidationButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function runChecks() {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/submissions/${submissionId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = (await response.json()) as {
        error?: string;
        validation?: { errors: number; warnings: number };
      };

      if (!response.ok) throw new Error(result.error || "The validation checks could not be run.");

      const errors = result.validation?.errors ?? 0;
      const warnings = result.validation?.warnings ?? 0;
      setMessage(`Checks complete: ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The validation checks could not be run.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="validation-rerun-control">
      <button className="button secondary" type="button" onClick={runChecks} disabled={busy}>
        {busy ? "Checking…" : "Run checks again"}
      </button>
      {message ? <small className="validation-action-message good-text">{message}</small> : null}
      {error ? <small className="validation-action-message bad-text">{error}</small> : null}
    </div>
  );
}
