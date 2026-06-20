"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RouteSubmissionView } from "@/lib/route-submissions";

function formatTimeAgo(timestamp: number) {
  const elapsedMs = Date.now() - timestamp;
  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusClassName(status: RouteSubmissionView["status"]) {
  if (status === "approved") return "text-emerald-400";
  if (status === "rejected") return "text-rose-400";
  return "text-amber-300";
}

export default function AdminModerationPanel() {
  const [submissions, setSubmissions] = useState<RouteSubmissionView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState<"pending" | "all">("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/admin/moderation");
      const payload = (await response.json().catch(() => ({}))) as {
        submissions?: RouteSubmissionView[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load moderation queue.");
      }

      setSubmissions(Array.isArray(payload.submissions) ? payload.submissions : []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load moderation queue.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const pendingCount = useMemo(
    () => submissions.filter((submission) => submission.status === "pending").length,
    [submissions]
  );

  const visibleSubmissions = useMemo(() => {
    if (activeFilter === "all") return submissions;
    return submissions.filter((submission) => submission.status === "pending");
  }, [activeFilter, submissions]);

  const moderateSubmission = async (submissionId: string, action: "approve" | "reject") => {
    setUpdatingId(submissionId);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/moderation/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        submission?: RouteSubmissionView;
        error?: string;
      };

      if (!response.ok || !payload.submission) {
        throw new Error(payload.error ?? "Could not update submission.");
      }

      setSubmissions((previous) =>
        previous.map((submission) =>
          submission.id === submissionId ? payload.submission! : submission
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update submission.";
      setErrorMessage(message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#111215] border border-white/10 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">Community Routes</h2>
            <p className="text-xs text-gray-400 mt-1">
              Approve routes before they appear in the public approved feed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase text-amber-300">
              {pendingCount} pending
            </span>
            <button
              type="button"
              onClick={() => void loadSubmissions()}
              className="bg-white/[0.04] border border-white/10 text-gray-300 font-bold py-2 px-3 rounded-xl text-[10px] font-mono uppercase"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter("pending")}
            className={`py-2 px-3 rounded-xl text-[10px] font-mono uppercase border ${
              activeFilter === "pending"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                : "bg-white/[0.03] border-white/10 text-gray-400"
            }`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`py-2 px-3 rounded-xl text-[10px] font-mono uppercase border ${
              activeFilter === "all"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                : "bg-white/[0.03] border-white/10 text-gray-400"
            }`}
          >
            All Submissions
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-200">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="bg-[#111215] border border-white/10 rounded-2xl p-8 text-sm text-gray-400">
          Loading moderation queue...
        </div>
      ) : visibleSubmissions.length === 0 ? (
        <div className="bg-[#111215] border border-white/10 rounded-2xl p-8 text-sm text-gray-400">
          {activeFilter === "pending"
            ? "No pending route submissions right now."
            : "No route submissions have been recorded yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSubmissions.map((submission) => (
            <div
              key={submission.id}
              className="bg-[#111215] border border-white/10 rounded-2xl p-5"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-white">{submission.name}</h3>
                    <span
                      className={`text-[10px] font-mono uppercase ${statusClassName(submission.status)}`}
                    >
                      {submission.status}
                    </span>
                  </div>
                  <p className="text-sm font-mono text-gray-400">
                    {submission.startLabel} → {submission.endLabel}
                  </p>
                  {submission.notes && (
                    <p className="text-sm text-gray-300 leading-relaxed">{submission.notes}</p>
                  )}
                  <div className="text-[11px] text-gray-500 space-y-1">
                    <p>
                      Submitted by {submission.submitterName || "Unknown driver"}
                      {submission.submitterEmail ? ` • ${submission.submitterEmail}` : ""}
                    </p>
                    <p>Submitted {formatTimeAgo(submission.submittedAt)}</p>
                  </div>
                </div>

                {submission.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={updatingId === submission.id}
                      onClick={() => void moderateSubmission(submission.id, "approve")}
                      className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2 rounded-xl text-[10px] font-mono uppercase font-bold disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === submission.id}
                      onClick={() => void moderateSubmission(submission.id, "reject")}
                      className="bg-rose-500/15 border border-rose-500/30 text-rose-300 px-4 py-2 rounded-xl text-[10px] font-mono uppercase font-bold disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
