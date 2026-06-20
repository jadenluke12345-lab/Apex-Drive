export type RouteSubmissionStatus = "pending" | "approved" | "rejected";

export type RouteSubmissionRecord = {
  id: string;
  clerk_user_id: string;
  submitter_name: string;
  submitter_email: string;
  name: string;
  start_label: string;
  end_label: string;
  notes: string;
  status: RouteSubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RouteSubmissionPayload = {
  name: string;
  startLabel: string;
  endLabel: string;
  notes: string;
};

export type RouteSubmissionView = {
  id: string;
  name: string;
  startLabel: string;
  endLabel: string;
  notes: string;
  status: RouteSubmissionStatus;
  submittedAt: number;
  submitterName: string;
  submitterEmail: string;
  reviewedAt: number | null;
  isOwn?: boolean;
};

export function routeSubmissionRecordToView(
  record: RouteSubmissionRecord
): RouteSubmissionView {
  return {
    id: record.id,
    name: record.name,
    startLabel: record.start_label,
    endLabel: record.end_label,
    notes: record.notes,
    status: record.status,
    submittedAt: Date.parse(record.created_at),
    submitterName: record.submitter_name,
    submitterEmail: record.submitter_email,
    reviewedAt: record.reviewed_at ? Date.parse(record.reviewed_at) : null,
  };
}

export function routeSubmissionPayloadToRow(input: {
  clerkUserId: string;
  submitterName: string;
  submitterEmail: string;
  payload: RouteSubmissionPayload;
}): Omit<
  RouteSubmissionRecord,
  "id" | "status" | "reviewed_by" | "reviewed_at" | "created_at" | "updated_at"
> {
  return {
    clerk_user_id: input.clerkUserId,
    submitter_name: input.submitterName.trim(),
    submitter_email: input.submitterEmail.trim(),
    name: input.payload.name.trim(),
    start_label: input.payload.startLabel.trim(),
    end_label: input.payload.endLabel.trim(),
    notes: input.payload.notes.trim(),
  };
}
