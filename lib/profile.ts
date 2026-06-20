export type SubscriptionTier = "free" | "interceptor" | "commander";

export type ProfileRecord = {
  id: string;
  clerk_user_id: string;
  display_name: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  preferred_units: "imperial" | "metric";
  receive_friend_requests: boolean;
  receive_convoy_updates: boolean;
  subscription_tier: SubscriptionTier;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfilePayload = {
  displayName: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  preferredUnits: string;
  receiveFriendRequests: boolean;
  receiveConvoyUpdates: boolean;
  tier: SubscriptionTier;
  avatarUrl?: string | null;
};

export type ProfileFormLike = {
  displayName: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  preferredUnits: string;
  receiveFriendRequests: boolean;
  receiveConvoyUpdates: boolean;
  tier: SubscriptionTier;
};

function normalizePreferredUnits(value: string): "imperial" | "metric" {
  return value === "metric" ? "metric" : "imperial";
}

function normalizeTier(value: string): SubscriptionTier {
  if (value === "interceptor" || value === "commander") return value;
  return "free";
}

export function profileRecordToForm(record: ProfileRecord): ProfileFormLike {
  return {
    displayName: record.display_name,
    email: record.email,
    phone: record.phone,
    city: record.city,
    bio: record.bio,
    preferredUnits: record.preferred_units,
    receiveFriendRequests: record.receive_friend_requests,
    receiveConvoyUpdates: record.receive_convoy_updates,
    tier: record.subscription_tier,
  };
}

export function profilePayloadToRow(
  clerkUserId: string,
  payload: ProfilePayload
): Omit<ProfileRecord, "id" | "created_at" | "updated_at"> {
  return {
    clerk_user_id: clerkUserId,
    display_name: payload.displayName.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    city: payload.city.trim(),
    bio: payload.bio.trim(),
    preferred_units: normalizePreferredUnits(payload.preferredUnits),
    receive_friend_requests: payload.receiveFriendRequests,
    receive_convoy_updates: payload.receiveConvoyUpdates,
    subscription_tier: normalizeTier(payload.tier),
    avatar_url: payload.avatarUrl ?? null,
  };
}

export function formToProfilePayload(
  form: ProfileFormLike,
  avatarUrl?: string | null
): ProfilePayload {
  return {
    displayName: form.displayName,
    email: form.email,
    phone: form.phone,
    city: form.city,
    bio: form.bio,
    preferredUnits: form.preferredUnits,
    receiveFriendRequests: form.receiveFriendRequests,
    receiveConvoyUpdates: form.receiveConvoyUpdates,
    tier: form.tier,
    avatarUrl: avatarUrl ?? null,
  };
}
