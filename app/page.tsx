"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import Link from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  CreditCard,
  Compass,
  LayoutDashboard,
  Lock,
  Map,
  Menu,
  MessageCircle,
  Route,
  SendHorizonal,
  Plus,
  Radio,
  Search,
  Settings,
  Sliders,
  Trash2,
  Users,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { isSiteAdminFromMetadata } from "@/lib/admin";

const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "").trim();
const MAPBOX_BASEMAP_TOKEN = MAPBOX_TOKEN;
const ENABLE_MAPBOX_BASEMAP =
  (process.env.NEXT_PUBLIC_ENABLE_MAPBOX_BASEMAP ?? "true") !== "false";
const MAPBOX_STYLE_URL = "mapbox://styles/mapbox/dark-v11?optimize=true";
const FALLBACK_BASEMAP_STYLE = {
  version: 8 as const,
  sources: {
    "dark-raster-tiles": {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    {
      id: "dark-raster-tiles-layer",
      type: "raster" as const,
      source: "dark-raster-tiles",
    },
  ],
};
const FALLBACK_LOCATION = { lat: 47.6062, lng: -122.3321 };
const FALLBACK_CITY_SECTOR_LABEL = "Seattle Sector";
const GPS_MIN_DELTA = 0.00015;
const NAVIGATION_REROUTE_MIN_DELTA = 0.00045;
const NAVIGATION_REROUTE_INTERVAL_MS = 12000;
const ROUTE_ARRIVAL_RADIUS_MILES = 0.08;
const ROUTE_START_READY_RADIUS_MILES = 0.08;
const GPS_VISUAL_UPDATE_MIN_DELTA = 0.00005;
const TETHER_BREAK_RADIUS_MILES = 0.5;
const PACE_NOTE_TRIGGER_RADIUS_MILES = 0.12;
const ROUTE_HISTORY_MAX_POINTS = 500;
const DEFAULT_MAP_ZOOM = 10.5;
const MAP_STYLE_LOAD_TIMEOUT_MS = 3000;
const MAP_HARD_LOAD_TIMEOUT_MS = 10000;
const QUICK_GPS_TIMEOUT_MS = 4000;
const GPS_FALLBACK_TIMER_MS = 5000;
const GPS_WATCH_TIMEOUT_MS = 15000;
const GPS_WATCH_MAX_AGE_MS = 30000;
const LAST_KNOWN_GPS_STORAGE_KEY = "apex-drive:last-known-gps";
const LAST_KNOWN_GPS_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const PLAN_IDS = ["starter", "pro", "elite"] as const;
const STORAGE_KEYS = {
  convoys: "convoys",
  vehicles: "vehicles",
  clubs: "clubs",
  meets: "meets",
  favorites: "favorite-routes",
  routeSubmissions: "route-submissions",
  notifications: "notifications",
  profileForm: "profile-form",
  profileImage: "profile-image",
  subscriptionForm: "subscription-form",
  friendRequests: "friend-requests",
  friends: "friends",
  directMessages: "direct-messages",
  lastTab: "last-tab",
  mapZoom: "map-zoom",
  followMap: "follow-map",
  routeReplay: "route-replay-history",
} as const;
const SUBSCRIPTION_PLANS: ReadonlyArray<{
  id: SubscriptionPlan;
  label: string;
  price: string;
}> = [
  { id: "starter", label: "Digital Garage", price: "Free • 2 slots + ads" },
  { id: "pro", label: "Apex Interceptor", price: "$7.99/mo • HUD + pace notes" },
  { id: "elite", label: "Convoy Commander", price: "$49.99/yr • unlimited garage + convoys" },
];

type TabId =
  | "dashboard"
  | "maps"
  | "convoys"
  | "garage"
  | "clubs"
  | "friends"
  | "settings";
type ConvoyStatus = "Approved" | "Pending" | "Joinable";
type ConvoyJoinMode = "invite" | "passcode";
type NotificationType = "report" | "convoy" | "friend" | "club" | "system";
type LocationSource = "gps" | "fallback" | "denied";
type SubscriptionPlan = (typeof PLAN_IDS)[number];
type SubscriptionTier = "free" | "interceptor" | "commander";
type AsphaltRisk = "ideal" | "caution" | "danger" | "unknown";
type MeshRelayMode = "cellular" | "mesh";
const TAB_IDS: readonly TabId[] = [
  "dashboard",
  "maps",
  "convoys",
  "garage",
  "clubs",
  "friends",
  "settings",
];

interface Vehicle {
  id: number;
  nickname: string;
  year: string;
  make: string;
  model: string;
  horsepower: string;
  modifications: string;
  imageUrl: string;
  ref: string;
}

interface Convoy {
  id: number;
  title: string;
  route: string;
  departureAt: string;
  capacity: number;
  members: number;
  status: ConvoyStatus;
  joinMode: ConvoyJoinMode;
  passcode?: string;
  host: string;
}

interface MapReport {
  id: string;
  type: "radar" | "hazard";
  lat: number;
  lng: number;
  label: string;
  createdAt: number;
}

interface NotificationItem {
  id: string;
  type: NotificationType;
  text: string;
  createdAt: number;
  unread: boolean;
}

interface Club {
  id: number;
  name: string;
  city: string;
  description: string;
  organizer: string;
  members: number;
  isMember: boolean;
}

interface Meet {
  id: number;
  title: string;
  location: string;
  date: string;
  club: string;
  host: string;
  attendees: number;
  isGoing: boolean;
}

interface CommunityContact {
  id: string;
  handle: string;
  sourceLabel: string;
}

interface FriendRequest {
  id: string;
  contactId: string;
  handle: string;
  sourceLabel: string;
  createdAt: number;
}

interface FriendContact {
  id: string;
  handle: string;
  sourceLabel: string;
  connectedAt: number;
}

interface DirectMessage {
  id: string;
  sender: "me" | "friend";
  text: string;
  createdAt: number;
}

interface RoutePreset {
  id: string;
  name: string;
  center: [number, number];
  description: string;
  start: { lat: number; lng: number; label: string };
  end: { lat: number; lng: number; label: string };
}

interface SearchResult {
  id: string;
  title: string;
  detail: string;
  tab: TabId;
}

interface TracedRoute {
  id: string;
  name: string;
  start: { lat: number; lng: number; label: string };
  end: { lat: number; lng: number; label: string };
  distanceMiles: number;
  durationMinutes: number;
  steps: string[];
}

interface RouteSubmission {
  id: string;
  name: string;
  startLabel: string;
  endLabel: string;
  notes: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: number;
  submitterName?: string;
  submitterEmail?: string;
  isOwn?: boolean;
}

interface FriendMapPresence {
  friendId: string;
  handle: string;
  lat: number;
  lng: number;
  activityType: "route" | "meet";
  activityLabel: string;
  routeName?: string;
  meetTitle?: string;
}

interface MeshNetworkState {
  relayActive: boolean;
  relayMode: MeshRelayMode;
  peerNodeCount: number;
  hopCount: number;
  lastRelayAt: number | null;
  preservedPinCount: number;
}

interface TrackingPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

interface DriveStatistics {
  totalMiles: number;
  durationMinutes: number;
  maxSpeedMph: number;
  avgSpeedMph: number;
  tetherBreakCount: number;
}

interface PaceNoteTrigger {
  id: string;
  lat: number;
  lng: number;
  message: string;
  custom?: boolean;
}

interface ProfileFormState {
  displayName: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  preferredUnits: string;
  receiveFriendRequests: boolean;
  receiveConvoyUpdates: boolean;
  tier: SubscriptionTier;
}

const ROUTE_PRESETS: RoutePreset[] = [
  {
    id: "yakima",
    name: "Yakima Canyon Scenic Byway",
    center: [-120.5392, 46.817],
    description: "US-821 canyon run from Ellensburg to Selah.",
    start: {
      lat: 46.9965,
      lng: -120.5478,
      label: "Ellensburg (US-821 Southbound Start)",
    },
    end: {
      lat: 46.6543,
      lng: -120.5304,
      label: "Selah (US-821 North End)",
    },
  },
  {
    id: "rainier",
    name: "Rainier Paradise Approach",
    center: [-121.8825, 46.7728],
    description: "WA-706 mountain drive from Ashford to Paradise Visitor Center.",
    start: {
      lat: 46.7562,
      lng: -122.0267,
      label: "Ashford (WA-706 Park Entry Corridor)",
    },
    end: {
      lat: 46.7854,
      lng: -121.7353,
      label: "Paradise Visitor Center",
    },
  },
  {
    id: "chuckanut",
    name: "Chuckanut Drive Coastal Run",
    center: [-122.4512, 48.6463],
    description: "WA-11 shoreline drive from Fairhaven to Bow-Edison.",
    start: {
      lat: 48.7347,
      lng: -122.5006,
      label: "Fairhaven Historic District",
    },
    end: {
      lat: 48.5621,
      lng: -122.3968,
      label: "Bow-Edison (Chuckanut North Exit)",
    },
  },
  {
    id: "canyon-creek",
    name: "Canyon Creek FR-31 Climb",
    center: [-121.862, 48.907],
    description: "One-lane forest road climb from Mt. Baker Highway to Damfino Lakes.",
    start: {
      lat: 48.8974,
      lng: -121.9453,
      label: "Glacier (SR-542 / FR-31 Junction)",
    },
    end: {
      lat: 48.9167,
      lng: -121.783,
      label: "Damfino Lakes Trailhead",
    },
  },
  {
    id: "hurricane-ridge",
    name: "Hurricane Ridge Ascent",
    center: [-123.461, 48.094],
    description: "Mt. Angeles Road switchbacks from Port Angeles to Hurricane Ridge.",
    start: {
      lat: 48.1126,
      lng: -123.4095,
      label: "Heart O' the Hills (Park Entry)",
    },
    end: {
      lat: 48.0753,
      lng: -123.5131,
      label: "Hurricane Ridge Visitor Center",
    },
  },
  {
    id: "flowery-trail",
    name: "Flowery Trail Selkirk Run",
    center: [-117.78, 48.29],
    description: "Tight hairpins and canyon bends from Chewelah through the Selkirk crest.",
    start: {
      lat: 48.2759,
      lng: -117.7286,
      label: "Chewelah (Flowery Trail West Start)",
    },
    end: {
      lat: 48.305,
      lng: -117.916,
      label: "Usk Valley (Flowery Trail East Exit)",
    },
  },
];

const PACE_NOTE_TRIGGERS: PaceNoteTrigger[] = [
  {
    id: "yakima-hairpin",
    lat: 46.85,
    lng: -120.538,
    message: "Caution: sharp hairpin corner approaching on US-821.",
  },
  {
    id: "rainier-switchback",
    lat: 46.768,
    lng: -121.88,
    message: "Caution: tight mountain switchback ahead on WA-706.",
  },
  {
    id: "chuckanut-blind",
    lat: 48.648,
    lng: -122.448,
    message: "Caution: blind coastal curve with oncoming traffic on Chuckanut Drive.",
  },
  {
    id: "canyon-creek-narrow",
    lat: 48.908,
    lng: -121.865,
    message: "Caution: one-lane forest pavement with oncoming traffic on FR-31.",
  },
  {
    id: "hurricane-switchback",
    lat: 48.092,
    lng: -123.468,
    message: "Caution: sustained mountain switchbacks ahead on Hurricane Ridge Road.",
  },
  {
    id: "flowery-hairpin",
    lat: 48.288,
    lng: -117.775,
    message: "Caution: tight Selkirk hairpins with rapid elevation change.",
  },
  {
    id: "commander-rally-apex",
    lat: 47.62,
    lng: -122.18,
    message: "Commander rally note: apex late — hold inside line through sector exit.",
    custom: true,
  },
];

const LEGACY_DEMO_CONVOY_TITLES = new Set([
  "Midnight Run: Canyon Carve",
  "Dawn Patrol: Coastline Sprint",
  "Apex Sunset Attack",
]);
const LEGACY_DEMO_CLUB_NAMES = new Set([
  "Cascade Night Crew",
  "Soundside Imports",
]);
const LEGACY_DEMO_MEET_TITLES = new Set([
  "Friday Waterfront Meet",
  "Canyon Dawn Rollout",
]);

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function surfaceStatusFromWeatherCode(weatherCode: number): {
  label: string;
  risk: AsphaltRisk;
} {
  if (weatherCode >= 95) return { label: "Severe Storm Hazard", risk: "danger" };
  if (weatherCode >= 71) return { label: "Snow / Ice Threat", risk: "danger" };
  if (weatherCode >= 51) return { label: "Wet / Damp Rain Surfaces", risk: "caution" };
  if (weatherCode >= 45) return { label: "Reduced Visibility / Moisture Risk", risk: "caution" };
  if (weatherCode >= 1) return { label: "Partly Cloudy / Dry", risk: "ideal" };
  return { label: "Dry & Clear", risk: "ideal" };
}

function formatCountdown(departureAt: string): string {
  const departure = new Date(departureAt).getTime();
  if (Number.isNaN(departure)) return "Schedule unavailable";
  const diffMs = departure - Date.now();
  if (diffMs <= 0) return "Deploying now";
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `T-minus ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
}

function formatDeparture(departureAt: string): string {
  const departure = new Date(departureAt);
  if (Number.isNaN(departure.getTime())) return "Invalid departure";
  return departure.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getStatusStyle(status: ConvoyStatus): string {
  if (status === "Approved") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (status === "Pending") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-blue-500/10 text-blue-400 border-blue-500/20";
}

function hasLocationMoved(
  previous: { lat: number; lng: number } | null,
  next: { lat: number; lng: number },
  minimumDelta = GPS_MIN_DELTA
): boolean {
  if (!previous) return true;
  return (
    Math.abs(previous.lat - next.lat) > minimumDelta ||
    Math.abs(previous.lng - next.lng) > minimumDelta
  );
}

function formatRouteDistance(distanceMiles: number): string {
  return `${distanceMiles.toFixed(1)} mi`;
}

function formatRouteDuration(durationMinutes: number): string {
  if (durationMinutes >= 60) {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = Math.round(durationMinutes % 60);
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, Math.round(durationMinutes))} min`;
}

function distanceMilesBetween(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(end.lat - start.lat);
  const dLng = toRadians(end.lng - start.lng);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function projectCoordinateByMiles(
  origin: { lat: number; lng: number },
  distanceMiles: number,
  bearingDegrees: number
): { lat: number; lng: number } {
  const earthRadiusMiles = 3958.8;
  const distanceRadians = distanceMiles / earthRadiusMiles;
  const bearingRadians = (bearingDegrees * Math.PI) / 180;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceRadians) +
      Math.cos(lat1) * Math.sin(distanceRadians) * Math.cos(bearingRadians)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(distanceRadians) * Math.cos(lat1),
      Math.cos(distanceRadians) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: ((lng2 * 180) / Math.PI + 540) % 360 - 180,
  };
}

function interpolateCoordinate(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  progress: number
): { lat: number; lng: number } {
  const boundedProgress = clampNumber(progress, 0, 1);
  return {
    lat: start.lat + (end.lat - start.lat) * boundedProgress,
    lng: start.lng + (end.lng - start.lng) * boundedProgress,
  };
}

function buildStaticMapImageUrl(location: { lat: number; lng: number }): string {
  const lat = location.lat.toFixed(5);
  const lng = location.lng.toFixed(5);
  if (MAPBOX_TOKEN) {
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+00f2fe(${lng},${lat})/${lng},${lat},12,0,0/1200x700?access_token=${encodeURIComponent(
      MAPBOX_TOKEN
    )}`;
  }
  const center = `${lat},${lng}`;
  const marker = `${lat},${lng},lightblue1`;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${encodeURIComponent(
    center
  )}&zoom=12&size=1200x700&markers=${encodeURIComponent(marker)}`;
}

function buildFallbackEmbedMapUrl(location: { lat: number; lng: number }): string {
  const delta = 0.08;
  const left = Math.max(-180, location.lng - delta);
  const right = Math.min(180, location.lng + delta);
  const bottom = Math.max(-90, location.lat - delta);
  const top = Math.min(90, location.lat + delta);
  const bbox = `${left},${bottom},${right},${top}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox
  )}&layer=mapnik&marker=${location.lat.toFixed(5)}%2C${location.lng.toFixed(5)}`;
}

function makeCommunityContactId(handle: string): string {
  return `contact:${handle.trim().toLowerCase().replace(/\s+/g, "-")}`;
}

function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return (PLAN_IDS as readonly string[]).includes(value);
}

function planToTier(plan: SubscriptionPlan, active: boolean): SubscriptionTier {
  if (!active) return "free";
  if (plan === "pro") return "interceptor";
  if (plan === "elite") return "commander";
  return "free";
}

function tierGarageLimit(tier: SubscriptionTier): number | null {
  if (tier === "free") return 2;
  if (tier === "interceptor") return 5;
  return null;
}

function tierLabel(tier: SubscriptionTier): string {
  if (tier === "interceptor") return "Apex Interceptor";
  if (tier === "commander") return "Convoy Commander";
  return "Digital Garage (Free)";
}

function computeDriveStatistics(
  history: TrackingPoint[],
  tetherBreakCount: number
): DriveStatistics {
  if (history.length < 2) {
    return {
      totalMiles: 0,
      durationMinutes: 0,
      maxSpeedMph: 0,
      avgSpeedMph: 0,
      tetherBreakCount,
    };
  }

  let totalMiles = 0;
  let maxSpeedMph = 0;
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1];
    const current = history[index];
    const segmentMiles = distanceMilesBetween(previous, current);
    totalMiles += segmentMiles;
    const elapsedHours =
      (current.timestamp - previous.timestamp) / (1000 * 60 * 60);
    if (elapsedHours > 0) {
      maxSpeedMph = Math.max(maxSpeedMph, segmentMiles / elapsedHours);
    }
  }

  const durationMinutes = Math.max(
    0,
    Math.round(
      (history[history.length - 1].timestamp - history[0].timestamp) / 60000
    )
  );
  const avgSpeedMph =
    durationMinutes > 0 ? totalMiles / (durationMinutes / 60) : 0;

  return {
    totalMiles,
    durationMinutes,
    maxSpeedMph: Math.round(maxSpeedMph),
    avgSpeedMph: Math.round(avgSpeedMph),
    tetherBreakCount,
  };
}

const DRIVE_REPLAY_SOURCE = "drive-replay-trail";

function clearDriveReplayTrail(map: mapboxgl.Map) {
  if (map.getLayer("drive-replay-trail-line")) map.removeLayer("drive-replay-trail-line");
  if (map.getLayer("drive-replay-trail-glow")) map.removeLayer("drive-replay-trail-glow");
  if (map.getSource(DRIVE_REPLAY_SOURCE)) map.removeSource(DRIVE_REPLAY_SOURCE);
}

function upsertDriveReplayTrail(
  map: mapboxgl.Map,
  history: TrackingPoint[],
  activeIndex: number
) {
  if (history.length < 2) {
    clearDriveReplayTrail(map);
    return;
  }

  const safeIndex = Math.max(0, Math.min(activeIndex, history.length - 1));
  const coordinates = history
    .slice(0, safeIndex + 1)
    .map((point) => [point.lng, point.lat] as [number, number]);

  if (coordinates.length < 2) {
    clearDriveReplayTrail(map);
    return;
  }

  const geojson = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates,
        },
      },
    ],
  };

  const existingSource = map.getSource(DRIVE_REPLAY_SOURCE) as
    | mapboxgl.GeoJSONSource
    | undefined;
  if (existingSource) {
    existingSource.setData(geojson);
  } else {
    map.addSource(DRIVE_REPLAY_SOURCE, { type: "geojson", data: geojson });
  }

  if (!map.getLayer("drive-replay-trail-glow")) {
    map.addLayer({
      id: "drive-replay-trail-glow",
      type: "line",
      source: DRIVE_REPLAY_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#fbbf24",
        "line-width": 10,
        "line-opacity": 0.22,
        "line-blur": 1.2,
      },
    });
  }
  if (!map.getLayer("drive-replay-trail-line")) {
    map.addLayer({
      id: "drive-replay-trail-line",
      type: "line",
      source: DRIVE_REPLAY_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#fbbf24",
        "line-width": 4,
        "line-opacity": 0.95,
      },
    });
  }
}

function formatReplayClock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function speakPaceNote(message: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 1.05;
  utterance.pitch = 0.95;
  window.speechSynthesis.speak(utterance);
}

function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

function isLegacyDemoConvoy(convoy: Convoy): boolean {
  return LEGACY_DEMO_CONVOY_TITLES.has(convoy.title);
}

function isLegacyDemoClub(club: Club): boolean {
  return LEGACY_DEMO_CLUB_NAMES.has(club.name);
}

function isLegacyDemoMeet(meet: Meet): boolean {
  return LEGACY_DEMO_MEET_TITLES.has(meet.title);
}

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort persistence only.
  }
}

export default function Dashboard() {
  const { isLoaded: isUserLoaded, isSignedIn, user } = useUser();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeStartMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeEndMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routePinMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const createConvoyButtonRef = useRef<HTMLButtonElement>(null);
  const createConvoyFormRef = useRef<HTMLFormElement>(null);
  const routePinModeRef = useRef(false);
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const reportMarkersRef = useRef<globalThis.Map<string, mapboxgl.Marker>>(new globalThis.Map());
  const friendMarkersRef = useRef<globalThis.Map<string, mapboxgl.Marker>>(new globalThis.Map());
  const navigationRerouteInFlightRef = useRef(false);
  const lastNavigationRerouteAtRef = useRef(0);
  const lastNavigationRerouteLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const followMeEnabledRef = useRef(true);
  const routeNavigationActiveRef = useRef(false);
  const notifiedFriendMessageIdsRef = useRef<Set<string>>(new Set());
  const friendMessageNotificationHydratedRef = useRef(false);
  const lastPaceNoteKeyRef = useRef<string | null>(null);
  const replayMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const replayIndexRef = useRef(0);
  const routeTrackingHistoryRef = useRef<TrackingPoint[]>([]);
  const previousRouteHistoryLengthRef = useRef(0);

  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [persistedMapZoom, setPersistedMapZoom] = useState<number | null>(null);
  const [isFollowMeEnabled, setIsFollowMeEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const [locationSource, setLocationSource] = useState<LocationSource>("fallback");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState("Requesting GPS permission...");
  const [locationTelemetry, setLocationTelemetry] = useState("--");
  const [weatherCondition, setWeatherCondition] = useState("Waiting for GPS telemetry...");
  const [asphaltRisk, setAsphaltRisk] = useState<AsphaltRisk>("unknown");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(
    ROUTE_PRESETS[1]?.id ?? null
  );
  const [mapReports, setMapReports] = useState<MapReport[]>([]);
  const [activeRoute, setActiveRoute] = useState<TracedRoute | null>(null);
  const [isTracingRoute, setIsTracingRoute] = useState(false);
  const [isRouteNavigationActive, setIsRouteNavigationActive] = useState(false);
  const [isNavigationRerouting, setIsNavigationRerouting] = useState(false);
  const [navigationDestination, setNavigationDestination] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [favoriteRouteName, setFavoriteRouteName] = useState("");
  const [favoriteRoutes, setFavoriteRoutes] = useState<TracedRoute[]>([]);
  const [isRoutePinMode, setIsRoutePinMode] = useState(false);
  const [isFriendLayerVisible, setIsFriendLayerVisible] = useState(true);
  const [friendPresenceTick, setFriendPresenceTick] = useState(0);
  const [pendingRoutePin, setPendingRoutePin] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [isUsingFallbackMap, setIsUsingFallbackMap] = useState(false);
  const [mapRuntimeIssue, setMapRuntimeIssue] = useState<string | null>(null);
  const [isMapInteractionDisabled, setIsMapInteractionDisabled] = useState(false);
  const [isInteractiveMapReady, setIsInteractiveMapReady] = useState(false);
  const [staticMapImageFailed, setStaticMapImageFailed] = useState(false);
  const [isRoutePanelCollapsed, setIsRoutePanelCollapsed] = useState(false);
  const [isSectorPanelCollapsed, setIsSectorPanelCollapsed] = useState(true);
  const [activeRadarText, setActiveRadarText] = useState("SECTOR CLEAR");
  const [isTetherBroken, setIsTetherBroken] = useState(false);
  const [meshNetworkState, setMeshNetworkState] = useState<MeshNetworkState>({
    relayActive: false,
    relayMode: "cellular",
    peerNodeCount: 0,
    hopCount: 0,
    lastRelayAt: null,
    preservedPinCount: 0,
  });
  const [routeTrackingHistory, setRouteTrackingHistory] = useState<TrackingPoint[]>([]);
  const [tetherBreakCount, setTetherBreakCount] = useState(0);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplayScrubbing, setIsReplayScrubbing] = useState(false);
  const [isTierGateModalOpen, setIsTierGateModalOpen] = useState(false);
  const [tierGateMessage, setTierGateMessage] = useState("");
  const [convoyCalendarMonth, setConvoyCalendarMonth] = useState(() => new Date());
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => [
    {
      id: crypto.randomUUID(),
      type: "friend",
      text: "Nova_GT sent you a friend request.",
      createdAt: Date.now() - 8 * 60 * 1000,
      unread: true,
    },
    {
      id: crypto.randomUUID(),
      type: "convoy",
      text: "Your request for Midnight Run was approved.",
      createdAt: Date.now() - 55 * 60 * 1000,
      unread: true,
    },
  ]);

  const [convoys, setConvoys] = useState<Convoy[]>([]);

  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: 1,
      nickname: "Storm Charger",
      year: "2013",
      make: "Dodge",
      model: "Charger",
      horsepower: "370",
      modifications: "Cold air intake, stage 1 tune",
      imageUrl: "",
      ref: "ASSET-01",
    },
    {
      id: 2,
      nickname: "Ghost GT3",
      year: "2018",
      make: "Porsche",
      model: "911 GT3 RS",
      horsepower: "520",
      modifications: "Track alignment, titanium exhaust",
      imageUrl: "",
      ref: "ASSET-02",
    },
  ]);

  const [clubs, setClubs] = useState<Club[]>([]);

  const [meets, setMeets] = useState<Meet[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendContact[]>([]);
  const [directMessages, setDirectMessages] = useState<Record<string, DirectMessage[]>>({});
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isCreateConvoyOpen, setIsCreateConvoyOpen] = useState(false);

  const [passcodeInputs, setPasscodeInputs] = useState<Record<number, string>>({});

  const [convoyForm, setConvoyForm] = useState<{
    title: string;
    route: string;
    departureAt: string;
    capacity: number;
    joinMode: ConvoyJoinMode;
    passcode: string;
  }>({
    title: "",
    route: "",
    departureAt: "",
    capacity: 10,
    joinMode: "invite",
    passcode: "",
  });

  const [vehicleForm, setVehicleForm] = useState({
    nickname: "",
    year: "",
    make: "",
    model: "",
    horsepower: "",
    modifications: "",
    imageUrl: "",
  });

  const [clubForm, setClubForm] = useState({
    name: "",
    city: "",
    description: "",
  });

  const [meetForm, setMeetForm] = useState({
    title: "",
    location: "",
    date: "",
    club: "",
  });
  const [routeSubmissionForm, setRouteSubmissionForm] = useState({
    name: "",
    startLabel: "",
    endLabel: "",
    notes: "",
  });
  const [routeSubmissions, setRouteSubmissions] = useState<RouteSubmission[]>([]);

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    displayName: "Jaden Mason",
    email: "jadenluke12345@gmail.com",
    phone: "",
    city: "Seattle, WA",
    bio: "Performance builds, convoy hosting, and late-night route scouting.",
    preferredUnits: "imperial",
    receiveFriendRequests: true,
    receiveConvoyUpdates: true,
    tier: "free",
  });

  const [subscriptionForm, setSubscriptionForm] = useState<{
    billingEmail: string;
    plan: SubscriptionPlan;
    active: boolean;
    startedAt: string;
  }>({
    billingEmail: "jadenluke12345@gmail.com",
    plan: "starter",
    active: false,
    startedAt: "",
  });
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isBillingPortalLoading, setIsBillingPortalLoading] = useState(false);
  const [isDeleteAccountLoading, setIsDeleteAccountLoading] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [storageHydrated, setStorageHydrated] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.unread).length,
    [notifications]
  );
  const profileInitials = useMemo(() => {
    const parts = profileForm.displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "AD";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [profileForm.displayName]);
  const hasVerifiedEmail =
    user?.primaryEmailAddress?.verification?.status === "verified";
  const hasAnyPhoneNumber = (user?.phoneNumbers?.length ?? 0) > 0;
  const hasVerifiedPhone =
    user?.phoneNumbers?.some(
      (phoneNumber) => phoneNumber.verification?.status === "verified"
    ) ?? false;
  const isPhoneVerificationRequired = hasAnyPhoneNumber;
  const isPhoneVerificationSatisfied =
    !isPhoneVerificationRequired || hasVerifiedPhone;
  const canRenderSecureDashboard =
    isUserLoaded && isSignedIn && hasVerifiedEmail && isPhoneVerificationSatisfied;
  const userTier = useMemo(
    () => planToTier(subscriptionForm.plan, subscriptionForm.active),
    [subscriptionForm.active, subscriptionForm.plan]
  );
  const isSiteAdmin = useMemo(
    () =>
      isSiteAdminFromMetadata(
        user?.publicMetadata,
        user?.primaryEmailAddress?.emailAddress
      ),
    [user]
  );
  const effectiveUserTier = useMemo(
    () => (isSiteAdmin ? "commander" : userTier),
    [isSiteAdmin, userTier]
  );
  const stripeBilling = useMemo(() => {
    const subscriptionMeta = user?.publicMetadata?.subscription;
    if (!subscriptionMeta || typeof subscriptionMeta !== "object") {
      return { customerId: null as string | null, subscriptionId: null as string | null };
    }
    const record = subscriptionMeta as Record<string, unknown>;
    return {
      customerId:
        typeof record.stripeCustomerId === "string" ? record.stripeCustomerId : null,
      subscriptionId:
        typeof record.stripeSubscriptionId === "string"
          ? record.stripeSubscriptionId
          : null,
    };
  }, [user]);
  const garageLimit = useMemo(() => tierGarageLimit(effectiveUserTier), [effectiveUserTier]);
  const isGarageAtCapacity =
    garageLimit != null && vehicles.length >= garageLimit;
  const canUseHudAlerts =
    effectiveUserTier === "interceptor" || effectiveUserTier === "commander";
  const canUsePaceNotes = canUseHudAlerts;
  const canUseCustomPaceNotes = effectiveUserTier === "commander";
  const canUseMeshNetwork = effectiveUserTier === "commander";
  const canManagePrivateConvoys = effectiveUserTier === "commander";
  const showDisplayAds = effectiveUserTier === "free";
  const mainNavTabs: Array<{
    id: TabId;
    label: string;
    icon: typeof LayoutDashboard;
    locked: boolean;
  }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, locked: false },
    { id: "maps", label: "Interactive Maps", icon: Map, locked: false },
    { id: "convoys", label: "Private Convoys", icon: Compass, locked: !canManagePrivateConvoys },
    { id: "garage", label: "Digital Garage", icon: Car, locked: false },
    { id: "clubs", label: "Meets & Clubs", icon: Users, locked: false },
    { id: "friends", label: "Friends & Messages", icon: MessageCircle, locked: false },
    { id: "settings", label: "Profile Settings", icon: Settings, locked: false },
  ];
  const handleTabSelect = (tabId: TabId) => {
    setActiveTab(tabId);
    setIsSearchResultsOpen(false);
    setIsNotificationOpen(false);
    if (tabId !== "convoys") setIsCreateConvoyOpen(false);
    setIsMobileSidebarOpen(false);
  };
  const replayStatistics = useMemo(
    () =>
      computeDriveStatistics(
        routeTrackingHistory.slice(0, replayIndex + 1),
        replayIndex >= routeTrackingHistory.length - 1 ? tetherBreakCount : 0
      ),
    [replayIndex, routeTrackingHistory, tetherBreakCount]
  );
  const replayPoint = routeTrackingHistory[replayIndex] ?? null;
  const replayProgressPercent = useMemo(() => {
    if (routeTrackingHistory.length < 2) return 0;
    return Math.round((replayIndex / (routeTrackingHistory.length - 1)) * 100);
  }, [replayIndex, routeTrackingHistory.length]);
  const replayStartTimestamp = routeTrackingHistory[0]?.timestamp ?? null;
  const replayEndTimestamp =
    routeTrackingHistory[routeTrackingHistory.length - 1]?.timestamp ?? null;
  const isViewingPastReplay =
    routeTrackingHistory.length >= 2 && replayIndex < routeTrackingHistory.length - 1;
  const convoyCalendarDays = useMemo(() => {
    const year = convoyCalendarMonth.getFullYear();
    const month = convoyCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; events: Convoy[] }> = [];
    for (let index = 0; index < startOffset; index += 1) {
      cells.push({ day: null, events: [] });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayEvents = convoys.filter((convoy) => {
        const departure = new Date(convoy.departureAt);
        return (
          departure.getFullYear() === year &&
          departure.getMonth() === month &&
          departure.getDate() === day
        );
      });
      cells.push({ day, events: dayEvents });
    }
    return cells;
  }, [convoyCalendarMonth, convoys]);
  const navigationRemainingDistance = useMemo(() => {
    if (!isRouteNavigationActive || !navigationDestination || !userLocation) return null;
    return distanceMilesBetween(userLocation, {
      lat: navigationDestination.lat,
      lng: navigationDestination.lng,
    });
  }, [isRouteNavigationActive, navigationDestination, userLocation]);
  const selectedRoutePreset = useMemo(
    () => ROUTE_PRESETS.find((route) => route.id === selectedRouteId) ?? null,
    [selectedRouteId]
  );
  const isRouteModerator = isSiteAdmin;
  const selectedRouteStartDistance = useMemo(() => {
    if (!userLocation || !selectedRoutePreset) return null;
    return distanceMilesBetween(userLocation, {
      lat: selectedRoutePreset.start.lat,
      lng: selectedRoutePreset.start.lng,
    });
  }, [selectedRoutePreset, userLocation]);
  const hasArrivedAtSelectedRouteStart =
    selectedRoutePreset != null &&
    selectedRouteStartDistance != null &&
    selectedRouteStartDistance <= ROUTE_START_READY_RADIUS_MILES;
  const selectedRouteStartStatusText =
    selectedRoutePreset == null
      ? "No route selected."
      : selectedRouteStartDistance == null
      ? "Waiting for GPS lock to route start."
      : hasArrivedAtSelectedRouteStart
        ? "Arrived at route start."
        : `${formatRouteDistance(selectedRouteStartDistance)} to route start.`;
  const pendingRouteSubmissionCount = useMemo(() => {
    const source = isSiteAdmin
      ? routeSubmissions
      : routeSubmissions.filter((submission) => submission.isOwn);
    return source.filter((submission) => submission.status === "pending").length;
  }, [isSiteAdmin, routeSubmissions]);
  const approvedRouteSubmissions = useMemo(
    () =>
      routeSubmissions.filter((submission) => submission.status === "approved"),
    [routeSubmissions]
  );
  const ownRouteSubmissions = useMemo(
    () => routeSubmissions.filter((submission) => submission.isOwn),
    [routeSubmissions]
  );
  const asphaltIndicatorClasses = useMemo(() => {
    if (asphaltRisk === "danger") {
      return {
        text: "text-red-400",
        dot: "bg-red-500 shadow-[0_0_8px_#ef4444]",
      };
    }
    if (asphaltRisk === "ideal") {
      return {
        text: "text-emerald-400",
        dot: "bg-emerald-400",
      };
    }
    return {
      text: "text-amber-400",
      dot: "bg-amber-400",
    };
  }, [asphaltRisk]);
  const staticMapImageUrl = useMemo(
    () => buildStaticMapImageUrl(userLocation ?? FALLBACK_LOCATION),
    [userLocation]
  );
  const staticMapEmbedUrl = useMemo(
    () => buildFallbackEmbedMapUrl(userLocation ?? FALLBACK_LOCATION),
    [userLocation]
  );
  const isMapInteractionUnavailable = isMapInteractionDisabled;

  useEffect(() => {
    followMeEnabledRef.current = isFollowMeEnabled;
  }, [isFollowMeEnabled]);

  useEffect(() => {
    routeNavigationActiveRef.current = isRouteNavigationActive;
  }, [isRouteNavigationActive]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncMobilePanels = () => {
      if (mediaQuery.matches) {
        setIsRoutePanelCollapsed(true);
        setIsSectorPanelCollapsed(true);
      }
    };
    syncMobilePanels();
    mediaQuery.addEventListener("change", syncMobilePanels);
    return () => mediaQuery.removeEventListener("change", syncMobilePanels);
  }, []);

  const communityContacts = useMemo(() => {
    const contactsById = new globalThis.Map<string, CommunityContact>();
    const ownHandle = profileForm.displayName.trim().toLowerCase();
    const addContact = (handle: string, sourceLabel: string) => {
      const normalizedHandle = handle.trim();
      if (!normalizedHandle) return;
      if (normalizedHandle.toLowerCase() === ownHandle) return;
      const id = makeCommunityContactId(normalizedHandle);
      if (!contactsById.has(id)) {
        contactsById.set(id, {
          id,
          handle: normalizedHandle,
          sourceLabel,
        });
      }
    };

    clubs.forEach((club) => {
      addContact(club.organizer || `${club.name} Lead`, `Club • ${club.name}`);
    });

    meets.forEach((meet) => {
      addContact(meet.host, `Meet • ${meet.title}`);
    });

    return Array.from(contactsById.values()).sort((a, b) =>
      a.handle.localeCompare(b.handle)
    );
  }, [clubs, meets, profileForm.displayName]);
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);
  const pendingFriendRequestContactIds = useMemo(
    () => new Set(friendRequests.map((request) => request.contactId)),
    [friendRequests]
  );
  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.id === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  );
  const selectedFriendMessages = useMemo(() => {
    if (!selectedFriendId) return [] as DirectMessage[];
    return directMessages[selectedFriendId] ?? [];
  }, [directMessages, selectedFriendId]);
  const friendMapPresence = useMemo<FriendMapPresence[]>(() => {
    if (friends.length === 0) return [];
    const baseLocation = userLocation ?? FALLBACK_LOCATION;
    const meetCandidates = meets.length > 0 ? meets : [];

    return friends.map((friend, index) => {
      const seed = hashString(friend.id || friend.handle || String(index));
      const preferMeet = meetCandidates.length > 0 && seed % 3 === 0;

      if (preferMeet) {
        const meet = meetCandidates[seed % meetCandidates.length];
        const orbitDistance = 0.45 + ((seed + friendPresenceTick) % 35) / 100;
        const orbitBearing = (seed * 7 + friendPresenceTick * 13) % 360;
        const location = projectCoordinateByMiles(baseLocation, orbitDistance, orbitBearing);
        return {
          friendId: friend.id,
          handle: friend.handle,
          lat: location.lat,
          lng: location.lng,
          activityType: "meet",
          meetTitle: meet.title,
          activityLabel: `Signed up for ${meet.title}`,
        };
      }

      const route = ROUTE_PRESETS[seed % ROUTE_PRESETS.length];
      const progressBase = ((seed % 100) / 100 + friendPresenceTick * 0.04) % 1;
      const pulse = Math.sin((friendPresenceTick + seed) / 4) * 0.08;
      const progress = clampNumber(progressBase + pulse, 0.05, 0.95);
      const location = interpolateCoordinate(route.start, route.end, progress);
      return {
        friendId: friend.id,
        handle: friend.handle,
        lat: location.lat,
        lng: location.lng,
        activityType: "route",
        routeName: route.name,
        activityLabel: `Following ${route.name}`,
      };
    });
  }, [friendPresenceTick, friends, meets, userLocation]);

  useEffect(() => {
    if (friends.length === 0) return;
    const interval = window.setInterval(() => {
      setFriendPresenceTick((previous) => previous + 1);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [friends.length]);

  useEffect(() => {
    if (friendRequests.length === 0) return;
    setNotifications((previous) => {
      const alreadyHasFriendRequestAlert = previous.some(
        (notification) =>
          notification.type === "friend" &&
          /friend request/i.test(notification.text)
      );
      if (alreadyHasFriendRequestAlert) return previous;
      const newestRequest = friendRequests[0];
      return [
        {
          id: crypto.randomUUID(),
          type: "friend" as NotificationType,
          text: newestRequest
            ? `${newestRequest.handle} sent you a friend request.`
            : "You have a pending friend request.",
          createdAt: Date.now(),
          unread: true,
        },
        ...previous,
      ].slice(0, 5);
    });
  }, [friendRequests]);

  useEffect(() => {
    const friendMessages = Object.entries(directMessages).flatMap(
      ([friendId, thread]) =>
        thread
          .filter((message) => message.sender === "friend")
          .map((message) => ({ friendId, message }))
    );
    const seenMessageIds = notifiedFriendMessageIdsRef.current;

    if (!friendMessageNotificationHydratedRef.current) {
      friendMessages.forEach(({ message }) => {
        seenMessageIds.add(message.id);
      });
      friendMessageNotificationHydratedRef.current = true;
      return;
    }

    const newFriendMessages = friendMessages.filter(
      ({ message }) => !seenMessageIds.has(message.id)
    );
    if (newFriendMessages.length === 0) return;
    newFriendMessages.forEach(({ message }) => {
      seenMessageIds.add(message.id);
    });

    const friendNameById = new globalThis.Map<string, string>(
      friends.map((friend) => [friend.id, friend.handle] as const)
    );

    setNotifications((previous) => {
      let next = previous;
      const orderedMessages = [...newFriendMessages].sort(
        (first, second) => first.message.createdAt - second.message.createdAt
      );
      orderedMessages.forEach(({ friendId, message }) => {
        const friendHandle = friendNameById.get(friendId) ?? "A friend";
        const preview =
          message.text.length > 46
            ? `${message.text.slice(0, 46)}...`
            : message.text;
        next = [
          {
            id: crypto.randomUUID(),
            type: "friend" as NotificationType,
            text: `${friendHandle} sent you a message: ${preview}`,
            createdAt: Date.now(),
            unread: true,
          },
          ...next,
        ].slice(0, 5);
      });
      return next;
    });
  }, [directMessages, friends]);

  useEffect(() => {
    routePinModeRef.current = isRoutePinMode;
  }, [isRoutePinMode]);

  useEffect(() => {
    if (friends.length === 0) {
      if (selectedFriendId !== null) setSelectedFriendId(null);
      return;
    }
    if (!selectedFriendId || !friends.some((friend) => friend.id === selectedFriendId)) {
      setSelectedFriendId(friends[0].id);
    }
  }, [friends, selectedFriendId]);

  useEffect(() => {
    if (
      !isNotificationOpen &&
      !isSearchResultsOpen &&
      !isCreateConvoyOpen &&
      !isVehicleModalOpen
    ) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (isNotificationOpen) {
        const clickedNotificationPanel =
          notificationPanelRef.current?.contains(target) ?? false;
        const clickedNotificationButton =
          notificationButtonRef.current?.contains(target) ?? false;
        if (!clickedNotificationPanel && !clickedNotificationButton) {
          setIsNotificationOpen(false);
        }
      }

      if (isSearchResultsOpen) {
        const clickedSearchContainer =
          searchContainerRef.current?.contains(target) ?? false;
        if (!clickedSearchContainer) {
          setIsSearchResultsOpen(false);
        }
      }

      if (isCreateConvoyOpen && activeTab === "convoys") {
        const clickedCreateButton =
          createConvoyButtonRef.current?.contains(target) ?? false;
        const clickedCreateForm =
          createConvoyFormRef.current?.contains(target) ?? false;
        if (!clickedCreateButton && !clickedCreateForm) {
          setIsCreateConvoyOpen(false);
        }
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isNotificationOpen) setIsNotificationOpen(false);
      if (isSearchResultsOpen) setIsSearchResultsOpen(false);
      if (isCreateConvoyOpen) setIsCreateConvoyOpen(false);
      if (isVehicleModalOpen) setIsVehicleModalOpen(false);
      if (isDeleteAccountModalOpen) setIsDeleteAccountModalOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [
    activeTab,
    isCreateConvoyOpen,
    isNotificationOpen,
    isSearchResultsOpen,
    isDeleteAccountModalOpen,
    isVehicleModalOpen,
  ]);

  const storagePrefix = useMemo(
    () => (user?.id ? `apex-drive:${user.id}:` : null),
    [user?.id]
  );

  useEffect(() => {
    setStorageHydrated(false);
    setPersistedMapZoom(null);
    setIsFollowMeEnabled(true);
    setActiveTab("dashboard");
  }, [storagePrefix]);

  useEffect(() => {
    if (!isUserLoaded || !isSignedIn || !storagePrefix) return;

    const storedConvoys = readStorage<Convoy[]>(`${storagePrefix}${STORAGE_KEYS.convoys}`);
    if (Array.isArray(storedConvoys)) {
      const sanitizedConvoys = storedConvoys.filter(
        (convoy) => !isLegacyDemoConvoy(convoy)
      );
      setConvoys(sanitizedConvoys);
      if (sanitizedConvoys.length !== storedConvoys.length) {
        writeStorage(`${storagePrefix}${STORAGE_KEYS.convoys}`, sanitizedConvoys);
      }
    }

    const storedVehicles = readStorage<Vehicle[]>(`${storagePrefix}${STORAGE_KEYS.vehicles}`);
    if (Array.isArray(storedVehicles)) setVehicles(storedVehicles);

    const storedClubs = readStorage<Club[]>(`${storagePrefix}${STORAGE_KEYS.clubs}`);
    if (Array.isArray(storedClubs)) {
      const sanitizedClubs = storedClubs
        .filter((club) => !isLegacyDemoClub(club))
        .map((club) => ({
          ...club,
          organizer:
            typeof club.organizer === "string" && club.organizer.trim()
              ? club.organizer.trim()
              : `${club.name} Lead`,
        }));
      setClubs(sanitizedClubs);
      const shouldRewriteClubs =
        sanitizedClubs.length !== storedClubs.length ||
        sanitizedClubs.some(
          (club, index) => club.organizer !== (storedClubs[index]?.organizer ?? "")
        );
      if (shouldRewriteClubs) {
        writeStorage(`${storagePrefix}${STORAGE_KEYS.clubs}`, sanitizedClubs);
      }
    }

    const storedMeets = readStorage<Meet[]>(`${storagePrefix}${STORAGE_KEYS.meets}`);
    if (Array.isArray(storedMeets)) {
      const sanitizedMeets = storedMeets.filter((meet) => !isLegacyDemoMeet(meet));
      setMeets(sanitizedMeets);
      if (sanitizedMeets.length !== storedMeets.length) {
        writeStorage(`${storagePrefix}${STORAGE_KEYS.meets}`, sanitizedMeets);
      }
    }

    const storedFavorites = readStorage<TracedRoute[]>(
      `${storagePrefix}${STORAGE_KEYS.favorites}`
    );
    if (Array.isArray(storedFavorites)) setFavoriteRoutes(storedFavorites);

    const storedRouteReplay = readStorage<TrackingPoint[]>(
      `${storagePrefix}${STORAGE_KEYS.routeReplay}`
    );
    if (Array.isArray(storedRouteReplay)) {
      const sanitizedReplay = storedRouteReplay.filter(
        (point) =>
          point &&
          typeof point.lat === "number" &&
          typeof point.lng === "number" &&
          typeof point.timestamp === "number"
      );
      if (sanitizedReplay.length > 0) {
        setRouteTrackingHistory(sanitizedReplay.slice(-ROUTE_HISTORY_MAX_POINTS));
      }
    }

    const storedNotifications = readStorage<NotificationItem[]>(
      `${storagePrefix}${STORAGE_KEYS.notifications}`
    );
    if (Array.isArray(storedNotifications)) {
      setNotifications(storedNotifications.slice(0, 5));
    }

    const storedFriendRequests = readStorage<FriendRequest[]>(
      `${storagePrefix}${STORAGE_KEYS.friendRequests}`
    );
    if (Array.isArray(storedFriendRequests)) setFriendRequests(storedFriendRequests);

    const storedFriends = readStorage<FriendContact[]>(`${storagePrefix}${STORAGE_KEYS.friends}`);
    if (Array.isArray(storedFriends)) setFriends(storedFriends);

    const storedDirectMessages = readStorage<Record<string, DirectMessage[]>>(
      `${storagePrefix}${STORAGE_KEYS.directMessages}`
    );
    if (storedDirectMessages && typeof storedDirectMessages === "object") {
      setDirectMessages(storedDirectMessages);
    }

    const storedProfileForm = readStorage<typeof profileForm>(
      `${storagePrefix}${STORAGE_KEYS.profileForm}`
    );
    if (storedProfileForm && typeof storedProfileForm === "object") {
      setProfileForm((previous) => ({ ...previous, ...storedProfileForm }));
    }

    const storedProfileImage = readStorage<string>(`${storagePrefix}${STORAGE_KEYS.profileImage}`);
    if (typeof storedProfileImage === "string") setProfileImageUrl(storedProfileImage);

    const storedSubscription = readStorage<typeof subscriptionForm>(
      `${storagePrefix}${STORAGE_KEYS.subscriptionForm}`
    );
    if (storedSubscription && typeof storedSubscription === "object") {
      setSubscriptionForm((previous) => ({
        ...previous,
        ...storedSubscription,
        plan:
          typeof storedSubscription.plan === "string" &&
          isSubscriptionPlan(storedSubscription.plan)
            ? storedSubscription.plan
            : previous.plan,
      }));
    }

    const storedLastTab = readStorage<string>(`${storagePrefix}${STORAGE_KEYS.lastTab}`);
    if (typeof storedLastTab === "string" && isTabId(storedLastTab)) {
      setActiveTab(storedLastTab);
    }

    const storedMapZoom = readStorage<number>(`${storagePrefix}${STORAGE_KEYS.mapZoom}`);
    if (
      typeof storedMapZoom === "number" &&
      Number.isFinite(storedMapZoom) &&
      storedMapZoom >= 2 &&
      storedMapZoom <= 20
    ) {
      setPersistedMapZoom(storedMapZoom);
    }

    const storedFollowMap = readStorage<boolean>(`${storagePrefix}${STORAGE_KEYS.followMap}`);
    if (typeof storedFollowMap === "boolean") {
      setIsFollowMeEnabled(storedFollowMap);
    }

    setStorageHydrated(true);
  }, [isSignedIn, isUserLoaded, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.convoys}`, convoys);
  }, [convoys, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.vehicles}`, vehicles);
  }, [storageHydrated, storagePrefix, vehicles]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.clubs}`, clubs);
  }, [clubs, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.meets}`, meets);
  }, [meets, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.favorites}`, favoriteRoutes);
  }, [favoriteRoutes, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.notifications}`, notifications);
  }, [notifications, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.routeReplay}`, routeTrackingHistory);
  }, [routeTrackingHistory, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.friendRequests}`, friendRequests);
  }, [friendRequests, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.friends}`, friends);
  }, [friends, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.directMessages}`, directMessages);
  }, [directMessages, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.profileForm}`, profileForm);
  }, [profileForm, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.profileImage}`, profileImageUrl);
  }, [profileImageUrl, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.subscriptionForm}`, subscriptionForm);
  }, [storageHydrated, storagePrefix, subscriptionForm]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.lastTab}`, activeTab);
  }, [activeTab, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !storagePrefix) return;
    writeStorage(`${storagePrefix}${STORAGE_KEYS.followMap}`, isFollowMeEnabled);
  }, [isFollowMeEnabled, storageHydrated, storagePrefix]);

  useEffect(() => {
    if (!storageHydrated || !isUserLoaded || !isSignedIn) return;

    let cancelled = false;

    async function loadCloudProfile() {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok || cancelled) return;

        const payload = (await response.json()) as {
          profile?: Partial<ProfileFormState>;
          avatarUrl?: string | null;
        };

        if (payload.profile && typeof payload.profile === "object") {
          setProfileForm((previous) => ({
            ...previous,
            ...payload.profile,
            tier: previous.tier,
          }));
        }

        if (typeof payload.avatarUrl === "string" && payload.avatarUrl.trim()) {
          setProfileImageUrl(payload.avatarUrl);
        }
      } catch {
        // localStorage fallback remains active when cloud profile is unavailable.
      }
    }

    void loadCloudProfile();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isUserLoaded, storageHydrated]);

  useEffect(() => {
    if (!isUserLoaded || !isSignedIn || !storageHydrated) return;

    let cancelled = false;

    async function loadCloudRouteSubmissions() {
      try {
        const endpoint = isSiteAdmin ? "/api/admin/moderation" : "/api/routes/submissions";
        const response = await fetch(endpoint);
        if (!response.ok || cancelled) return;

        const payload = (await response.json()) as {
          submissions?: Array<{
            id: string;
            name: string;
            startLabel: string;
            endLabel: string;
            notes: string;
            status: RouteSubmission["status"];
            submittedAt: number;
            submitterName?: string;
            submitterEmail?: string;
            isOwn?: boolean;
          }>;
        };

        if (!Array.isArray(payload.submissions) || cancelled) return;

        setRouteSubmissions(
          payload.submissions.map((submission) => ({
            id: submission.id,
            name: submission.name,
            startLabel: submission.startLabel,
            endLabel: submission.endLabel,
            notes: submission.notes,
            status: submission.status,
            submittedAt: submission.submittedAt,
            submitterName: submission.submitterName,
            submitterEmail: submission.submitterEmail,
            isOwn: submission.isOwn,
          }))
        );
      } catch {
        // Keep empty submissions when cloud sync is unavailable.
      }
    }

    void loadCloudRouteSubmissions();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isSiteAdmin, isUserLoaded, storageHydrated]);

  useEffect(() => {
    if (!user) return;

    const fullName =
      user.fullName?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    const primaryEmail = user.primaryEmailAddress?.emailAddress ?? "";

    setProfileForm((previous) => {
      const nextDisplayName = fullName || previous.displayName;
      const nextEmail = primaryEmail || previous.email;
      if (
        nextDisplayName === previous.displayName &&
        nextEmail === previous.email
      ) {
        return previous;
      }
      return {
        ...previous,
        displayName: nextDisplayName,
        email: nextEmail,
      };
    });

    const subscriptionMeta = user.publicMetadata?.subscription;
    const normalizedSubscriptionMeta =
      subscriptionMeta && typeof subscriptionMeta === "object"
        ? (subscriptionMeta as Record<string, unknown>)
        : null;

    setSubscriptionForm((previous) => {
      const rawPlan = normalizedSubscriptionMeta?.plan;
      const rawActive = normalizedSubscriptionMeta?.active;
      const rawStatus = normalizedSubscriptionMeta?.status;
      const rawPeriodEnd = normalizedSubscriptionMeta?.currentPeriodEnd;
      const rawUpdatedAt = normalizedSubscriptionMeta?.updatedAt;

      const nextPlan =
        typeof rawPlan === "string" && isSubscriptionPlan(rawPlan)
          ? rawPlan
          : previous.plan;
      const nextActive =
        typeof rawActive === "boolean"
          ? rawActive
          : typeof rawStatus === "string"
            ? ["active", "trialing"].includes(rawStatus)
            : previous.active;
      const nextStartedAt =
        typeof rawPeriodEnd === "string"
          ? rawPeriodEnd
          : typeof rawUpdatedAt === "string"
            ? rawUpdatedAt
            : previous.startedAt;
      const nextTier = planToTier(nextPlan, nextActive);

      setProfileForm((profilePrevious) =>
        profilePrevious.tier === nextTier
          ? profilePrevious
          : { ...profilePrevious, tier: nextTier }
      );

      return {
        ...previous,
        billingEmail: primaryEmail || previous.billingEmail,
        plan: nextPlan,
        active: nextActive,
        startedAt: nextStartedAt,
      };
    });

    if (!profileImageUrl && user.imageUrl) {
      setProfileImageUrl(user.imageUrl);
    }
  }, [profileImageUrl, user]);

  useEffect(() => {
    setProfileForm((previous) =>
      previous.tier === effectiveUserTier
        ? previous
        : { ...previous, tier: effectiveUserTier }
    );
  }, [effectiveUserTier]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileSidebarOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    if (!canUseHudAlerts || !userLocation || friendMapPresence.length === 0) {
      setIsTetherBroken(false);
      setActiveRadarText("SECTOR CLEAR");
      return;
    }

    const nearestDistance = friendMapPresence.reduce((minimum, presence) => {
      const distance = distanceMilesBetween(userLocation, {
        lat: presence.lat,
        lng: presence.lng,
      });
      return Math.min(minimum, distance);
    }, Number.POSITIVE_INFINITY);

    const tetherBroken = nearestDistance > TETHER_BREAK_RADIUS_MILES;
    setIsTetherBroken((previous) => {
      if (tetherBroken && !previous) {
        setTetherBreakCount((count) => count + 1);
      }
      return tetherBroken;
    });
    setActiveRadarText(
      tetherBroken ? "TETHER BROKEN — TRAILING ASSET OUT OF RANGE" : "CONVOY TETHER LOCKED"
    );
  }, [canUseHudAlerts, friendMapPresence, userLocation]);

  useEffect(() => {
    if (!canUsePaceNotes || !userLocation) return;

    const hazardTriggers = mapReports.map((report) => ({
      id: report.id,
      lat: report.lat,
      lng: report.lng,
      message: `Caution: ${report.label.toLowerCase()} reported ahead.`,
      custom: false,
    }));
    const eligibleTriggers = [
      ...PACE_NOTE_TRIGGERS.filter(
        (trigger) => canUseCustomPaceNotes || !trigger.custom
      ),
      ...hazardTriggers,
    ];

    for (const trigger of eligibleTriggers) {
      const distance = distanceMilesBetween(userLocation, {
        lat: trigger.lat,
        lng: trigger.lng,
      });
      if (distance > PACE_NOTE_TRIGGER_RADIUS_MILES) continue;
      if (lastPaceNoteKeyRef.current === trigger.id) continue;
      lastPaceNoteKeyRef.current = trigger.id;
      speakPaceNote(trigger.message);
      break;
    }
  }, [
    canUseCustomPaceNotes,
    canUsePaceNotes,
    mapReports,
    userLocation,
  ]);

  useEffect(() => {
    if (!canUseMeshNetwork) {
      setMeshNetworkState((previous) =>
        previous.relayMode === "cellular" && !previous.relayActive
          ? previous
          : {
              relayActive: false,
              relayMode: "cellular",
              peerNodeCount: 0,
              hopCount: 0,
              lastRelayAt: null,
              preservedPinCount: mapReports.length,
            }
      );
      return;
    }

    const cellularOnline = locationSource === "gps";
    if (cellularOnline) {
      setMeshNetworkState((previous) => ({
        ...previous,
        relayActive: false,
        relayMode: "cellular",
        peerNodeCount: Math.max(previous.peerNodeCount, friendMapPresence.length),
        preservedPinCount: mapReports.length + friendMapPresence.length,
      }));
      return;
    }

    setMeshNetworkState({
      relayActive: true,
      relayMode: "mesh",
      peerNodeCount: Math.max(2, friendMapPresence.length + 1),
      hopCount: Math.min(4, friendMapPresence.length + 1),
      lastRelayAt: Date.now(),
      preservedPinCount: mapReports.length + friendMapPresence.length + 1,
    });
  }, [
    canUseMeshNetwork,
    friendMapPresence.length,
    locationSource,
    mapReports.length,
  ]);

  useEffect(() => {
    replayIndexRef.current = replayIndex;
  }, [replayIndex]);

  useEffect(() => {
    routeTrackingHistoryRef.current = routeTrackingHistory;
  }, [routeTrackingHistory]);

  useEffect(() => {
    const previousLength = previousRouteHistoryLengthRef.current;
    const nextLength = routeTrackingHistory.length;
    previousRouteHistoryLengthRef.current = nextLength;

    if (nextLength === 0) {
      setReplayIndex(0);
      return;
    }

    setReplayIndex((current) => {
      if (current > nextLength - 1) return nextLength - 1;
      if (previousLength > 0 && current >= previousLength - 1) return nextLength - 1;
      return current;
    });
  }, [routeTrackingHistory.length]);

  useEffect(() => {
    const marker = userMarkerRef.current;
    if (!marker) return;
    const hideLiveMarker = isViewingPastReplay || isReplayScrubbing;
    marker.getElement().style.opacity = hideLiveMarker ? "0" : "1";
    marker.getElement().style.pointerEvents = hideLiveMarker ? "none" : "auto";
  }, [isReplayScrubbing, isViewingPastReplay]);

  useEffect(() => {
    if (routeTrackingHistory.length < 2) {
      replayMarkerRef.current?.remove();
      replayMarkerRef.current = null;
      const map = mapRef.current;
      if (map?.isStyleLoaded()) clearDriveReplayTrail(map);
      return;
    }

    if (!replayPoint || !mapRef.current) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) return;

    upsertDriveReplayTrail(map, routeTrackingHistory, replayIndex);

    const center: [number, number] = [replayPoint.lng, replayPoint.lat];
    if (replayMarkerRef.current) {
      replayMarkerRef.current.setLngLat(center);
    } else {
      const markerEl = document.createElement("div");
      markerEl.style.cssText =
        "width:14px;height:14px;background:#fbbf24;border:3px solid #fff;border-radius:50%;box-shadow:0 0 14px rgba(251,191,36,0.95);";
      replayMarkerRef.current = new mapboxgl.Marker({ element: markerEl, anchor: "center" })
        .setLngLat(center)
        .addTo(map);
    }

    if (isViewingPastReplay || isReplayScrubbing) {
      map.easeTo({
        center,
        zoom: Math.max(map.getZoom(), 12.5),
        duration: isReplayScrubbing ? 180 : 320,
        essential: true,
      });
    }
  }, [
    isReplayScrubbing,
    isViewingPastReplay,
    replayIndex,
    replayPoint,
    routeTrackingHistory,
  ]);

  useEffect(() => {
    return () => {
      replayMarkerRef.current?.remove();
      replayMarkerRef.current = null;
      const map = mapRef.current;
      if (map?.isStyleLoaded()) clearDriveReplayTrail(map);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionState = params.get("subscription");
    if (subscriptionState === "success") {
      setSubscriptionForm((previous) => ({
        ...previous,
        active: true,
        startedAt: previous.startedAt || new Date().toISOString(),
      }));
      pushNotification({
        type: "system",
        text: "Subscription checkout completed successfully.",
      });
      params.delete("subscription");
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    } else if (subscriptionState === "cancelled") {
      pushNotification({
        type: "system",
        text: "Subscription checkout was cancelled.",
      });
      params.delete("subscription");
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredRoutes = useMemo(() => {
    if (!normalizedSearch) return ROUTE_PRESETS;
    return ROUTE_PRESETS.filter(
      (route) =>
        route.name.toLowerCase().includes(normalizedSearch) ||
        route.description.toLowerCase().includes(normalizedSearch) ||
        route.start.label.toLowerCase().includes(normalizedSearch) ||
        route.end.label.toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch]);

  const filteredConvoys = useMemo(() => {
    if (!normalizedSearch) return convoys;
    return convoys.filter((convoy) =>
      [convoy.title, convoy.route, convoy.host, convoy.joinMode]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [convoys, normalizedSearch]);

  const filteredVehicles = useMemo(() => {
    if (!normalizedSearch) return vehicles;
    return vehicles.filter((vehicle) =>
      [
        vehicle.nickname,
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.modifications,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [vehicles, normalizedSearch]);

  const filteredClubs = useMemo(() => {
    if (!normalizedSearch) return clubs;
    return clubs.filter((club) =>
      [club.name, club.city, club.description, club.organizer]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [clubs, normalizedSearch]);

  const filteredMeets = useMemo(() => {
    if (!normalizedSearch) return meets;
    return meets.filter((meet) =>
      [meet.title, meet.location, meet.club, meet.host].join(" ").toLowerCase().includes(normalizedSearch)
    );
  }, [meets, normalizedSearch]);
  const upcomingMeetsForDashboard = useMemo(() => {
    const now = Date.now();
    return meets
      .filter((meet) => {
        const meetTime = new Date(meet.date).getTime();
        return Number.isFinite(meetTime) && meetTime >= now - 60_000;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4);
  }, [meets]);

  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [] as SearchResult[];
    const results: SearchResult[] = [];

    convoys.forEach((convoy) => {
      if (
        [convoy.title, convoy.route, convoy.host].join(" ").toLowerCase().includes(normalizedSearch)
      ) {
        results.push({
          id: `convoy-${convoy.id}`,
          title: convoy.title,
          detail: `Convoy • ${convoy.route}`,
          tab: "convoys",
        });
      }
    });

    vehicles.forEach((vehicle) => {
      const descriptor = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.nickname}`;
      if (descriptor.toLowerCase().includes(normalizedSearch)) {
        results.push({
          id: `vehicle-${vehicle.id}`,
          title: vehicle.nickname,
          detail: `Garage • ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          tab: "garage",
        });
      }
    });

    clubs.forEach((club) => {
      if (
        [club.name, club.city, club.description, club.organizer]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        results.push({
          id: `club-${club.id}`,
          title: club.name,
          detail: `Club • ${club.city}`,
          tab: "clubs",
        });
      }
    });

    meets.forEach((meet) => {
      if ([meet.title, meet.location, meet.club].join(" ").toLowerCase().includes(normalizedSearch)) {
        results.push({
          id: `meet-${meet.id}`,
          title: meet.title,
          detail: `Meet • ${new Date(meet.date).toLocaleString()}`,
          tab: "clubs",
        });
      }
    });

    notifications.forEach((notification) => {
      if (notification.text.toLowerCase().includes(normalizedSearch)) {
        results.push({
          id: `notification-${notification.id}`,
          title: notification.text,
          detail: `Notification • ${formatTimeAgo(notification.createdAt)}`,
          tab: "dashboard",
        });
      }
    });

    favoriteRoutes.forEach((route) => {
      if (
        [route.name, route.start.label, route.end.label]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        results.push({
          id: `favorite-route-${route.id}`,
          title: route.name,
          detail: `Route • ${route.start.label} to ${route.end.label}`,
          tab: "maps",
        });
      }
    });

    friends.forEach((friend) => {
      if (friend.handle.toLowerCase().includes(normalizedSearch)) {
        results.push({
          id: `friend-${friend.id}`,
          title: friend.handle,
          detail: `Friend • ${friend.sourceLabel}`,
          tab: "friends",
        });
      }
    });

    return results.slice(0, 10);
  }, [
    clubs,
    convoys,
    favoriteRoutes,
    friends,
    meets,
    normalizedSearch,
    notifications,
    vehicles,
  ]);

  function pushNotification(payload: Omit<NotificationItem, "id" | "createdAt" | "unread">) {
    setNotifications((previous) =>
      [
        {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          unread: true,
          ...payload,
        },
        ...previous,
      ].slice(0, 5)
    );
  }

  const resetNavigationRerouteState = () => {
    navigationRerouteInFlightRef.current = false;
    lastNavigationRerouteAtRef.current = 0;
    lastNavigationRerouteLocationRef.current = null;
    setIsNavigationRerouting(false);
  };

  const stopRouteNavigation = (message?: string, clearRoute = false) => {
    if (clearRoute) {
      clearRouteVisualization(true);
    }
    if (!isRouteNavigationActive && !navigationDestination) return;
    routeNavigationActiveRef.current = false;
    setIsRouteNavigationActive(false);
    setNavigationDestination(null);
    resetNavigationRerouteState();
    if (message) {
      pushNotification({
        type: "system",
        text: message,
      });
    }
  };

  const clearRouteAndNavigation = () => {
    stopRouteNavigation(undefined, true);
    setSelectedRouteId(null);
    setIsRoutePanelCollapsed(false);
  };

  const markNotificationRead = (id: string) => {
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id ? { ...notification, unread: false } : notification
      )
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((previous) =>
      previous.map((notification) => ({ ...notification, unread: false }))
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const removeMapReport = (id: string) => {
    reportMarkersRef.current.get(id)?.remove();
    reportMarkersRef.current.delete(id);
    setMapReports((previous) => previous.filter((report) => report.id !== id));
  };

  const focusFriendPresenceOnMap = (presence: FriendMapPresence) => {
    setActiveTab("dashboard");
    window.setTimeout(() => {
      mapRef.current?.flyTo({
        center: [presence.lng, presence.lat],
        zoom: 12.8,
        pitch: 45,
        bearing: -20,
        essential: true,
      });
    }, 120);
  };

  const clearRouteVisualization = (clearState = false) => {
    const map = mapRef.current;
    if (map) {
      if (map.getLayer("trace-route-line")) map.removeLayer("trace-route-line");
      if (map.getLayer("trace-route-glow")) map.removeLayer("trace-route-glow");
      if (map.getSource("trace-route")) map.removeSource("trace-route");
    }
    routeStartMarkerRef.current?.remove();
    routeEndMarkerRef.current?.remove();
    routeStartMarkerRef.current = null;
    routeEndMarkerRef.current = null;
    if (clearState) setActiveRoute(null);
  };

  const clearRoutePin = () => {
    routePinMarkerRef.current?.remove();
    routePinMarkerRef.current = null;
    setPendingRoutePin(null);
    routePinModeRef.current = false;
    setIsRoutePinMode(false);
  };

  const upsertRouteLine = (coordinates: [number, number][]) => {
    const map = mapRef.current;
    if (!map) return;

    const geojson = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates,
          },
        },
      ],
    };

    const existingSource = map.getSource("trace-route") as mapboxgl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojson);
    } else {
      map.addSource("trace-route", { type: "geojson", data: geojson });
    }

    if (!map.getLayer("trace-route-glow")) {
      map.addLayer({
        id: "trace-route-glow",
        type: "line",
        source: "trace-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#00F2FE",
          "line-width": 10,
          "line-opacity": 0.2,
          "line-blur": 1.2,
        },
      });
    }
    if (!map.getLayer("trace-route-line")) {
      map.addLayer({
        id: "trace-route-line",
        type: "line",
        source: "trace-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#00F2FE",
          "line-width": 4,
          "line-opacity": 0.95,
        },
      });
    }
  };

  const placeRouteEndpoints = (
    map: mapboxgl.Map,
    start: { lat: number; lng: number },
    end: { lat: number; lng: number }
  ) => {
    routeStartMarkerRef.current?.remove();
    routeEndMarkerRef.current?.remove();

    const startEl = document.createElement("div");
    startEl.style.cssText =
      "width:12px;height:12px;background:#00F2FE;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 12px rgba(0,242,254,0.85);";
    routeStartMarkerRef.current = new mapboxgl.Marker({ element: startEl, anchor: "center" })
      .setLngLat([start.lng, start.lat])
      .addTo(map);

    const endEl = document.createElement("div");
    endEl.style.cssText =
      "width:13px;height:13px;background:#00F2FE;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 14px rgba(0,242,254,0.9);";
    routeEndMarkerRef.current = new mapboxgl.Marker({ element: endEl, anchor: "center" })
      .setLngLat([end.lng, end.lat])
      .addTo(map);
  };

  const resolveCoordinateLabel = async (lat: number, lng: number): Promise<string> => {
    if (!MAPBOX_TOKEN) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address,neighborhood,place,locality&limit=1&access_token=${MAPBOX_TOKEN}`
      );
      const data = await response.json();
      const feature = data.features?.[0];
      return feature?.text ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  const setRoutePinAtLocation = async (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;

    routePinMarkerRef.current?.remove();
    const pinEl = document.createElement("div");
    pinEl.style.cssText =
      "width:16px;height:16px;background:#00F2FE;border:3px solid #ffffff;border-radius:9999px;box-shadow:0 0 14px rgba(0,242,254,0.85);";
    routePinMarkerRef.current = new mapboxgl.Marker({ element: pinEl, anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(map);

    routePinModeRef.current = false;
    setIsRoutePinMode(false);
    const label = await resolveCoordinateLabel(lat, lng);
    setPendingRoutePin({ lat, lng, label });
    pushNotification({
      type: "system",
      text: `Route pin dropped at ${label}. Tap "Trace To Pin" to build route.`,
    });
  };

  const traceRouteBetween = async (options: {
    start: { lat: number; lng: number };
    end: { lat: number; lng: number };
    startLabel: string;
    endLabel: string;
    name?: string;
    switchToDashboard?: boolean;
    fitToRoute?: boolean;
    silent?: boolean;
  }) => {
    if (!MAPBOX_TOKEN) {
      if (!options.silent) {
        pushNotification({
          type: "system",
          text: "Map routing is unavailable until NEXT_PUBLIC_MAPBOX_TOKEN is configured.",
        });
      }
      return;
    }
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      if (!options.silent) {
        pushNotification({
          type: "system",
          text: "Map is still loading. Please try tracing the route again.",
        });
      }
      return;
    }

    const isNavigationRefresh = options.silent === true && options.fitToRoute === false;
    if (isRouteNavigationActive && !isNavigationRefresh) {
      stopRouteNavigation("Stopped active route navigation.");
    }

    if (!options.silent) {
      setIsTracingRoute(true);
    }
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${options.start.lng},${options.start.lat};${options.end.lng},${options.end.lat}?alternatives=true&geometries=geojson&overview=full&steps=true&language=en&access_token=${MAPBOX_TOKEN}`
      );
      const data = await response.json();
      const routes = (Array.isArray(data.routes) ? data.routes : []) as Array<{
        geometry?: { coordinates?: [number, number][] };
        distance?: number;
        duration?: number;
        legs?: Array<{ steps?: Array<{ maneuver?: { instruction?: string } }> }>;
      }>;
      let route = routes[0];
      for (const candidate of routes.slice(1)) {
        const routeDuration =
          typeof route?.duration === "number" ? route.duration : Number.POSITIVE_INFINITY;
        const candidateDuration =
          typeof candidate.duration === "number"
            ? candidate.duration
            : Number.POSITIVE_INFINITY;
        if (candidateDuration < routeDuration) {
          route = candidate;
        }
      }
      const coordinates = route?.geometry?.coordinates as [number, number][] | undefined;

      if (
        !route ||
        !coordinates ||
        coordinates.length < 2 ||
        typeof route.distance !== "number" ||
        typeof route.duration !== "number"
      ) {
        throw new Error("No route returned");
      }

      clearRouteVisualization();
      upsertRouteLine(coordinates);
      placeRouteEndpoints(map, options.start, options.end);

      if (options.fitToRoute !== false) {
        const bounds = new mapboxgl.LngLatBounds(
          [coordinates[0][0], coordinates[0][1]],
          [coordinates[0][0], coordinates[0][1]]
        );
        coordinates.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, { padding: 90, duration: 900, maxZoom: 14 });
      }

      const routeName = options.name ?? `${options.startLabel} to ${options.endLabel}`;
      const summary: TracedRoute = {
        id: crypto.randomUUID(),
        name: routeName,
        start: { ...options.start, label: options.startLabel },
        end: { ...options.end, label: options.endLabel },
        distanceMiles: route.distance / 1609.344,
        durationMinutes: route.duration / 60,
        steps:
          route.legs?.[0]?.steps
            ?.slice(0, 5)
            .map((step: { maneuver?: { instruction?: string } }) => step.maneuver?.instruction ?? "")
            .filter(Boolean) ?? [],
      };
      setActiveRoute(summary);

      if (options.switchToDashboard !== false) setActiveTab("dashboard");
      if (!options.silent) {
        pushNotification({
          type: "system",
          text: `Route traced: ${summary.name} • ${formatRouteDistance(summary.distanceMiles)} • ${formatRouteDuration(summary.durationMinutes)}.`,
        });
      }
    } catch {
      if (!options.silent) {
        pushNotification({
          type: "system",
          text: "Unable to trace route for this pin right now.",
        });
      }
    } finally {
      if (!options.silent) {
        setIsTracingRoute(false);
      }
    }
  };

  const maybeRefreshNavigationRoute = async (
    currentLocation: { lat: number; lng: number },
    options?: {
      force?: boolean;
      destinationOverride?: { lat: number; lng: number; label: string };
    }
  ) => {
    const destination = options?.destinationOverride ?? navigationDestination;
    if (!destination) return;
    if (!options?.force && !isRouteNavigationActive) return;

    const destinationPoint = {
      lat: destination.lat,
      lng: destination.lng,
    };
    const remainingDistanceMiles = distanceMilesBetween(
      currentLocation,
      destinationPoint
    );

    if (remainingDistanceMiles <= ROUTE_ARRIVAL_RADIUS_MILES) {
      stopRouteNavigation(`Arrived at ${destination.label}.`, true);
      return;
    }

    if (navigationRerouteInFlightRef.current) return;

    const forceReroute = options?.force === true;
    if (!forceReroute) {
      const now = Date.now();
      const hasNeverRerouted = lastNavigationRerouteAtRef.current === 0;
      const intervalElapsed =
        now - lastNavigationRerouteAtRef.current >= NAVIGATION_REROUTE_INTERVAL_MS;
      const movedSinceLastReroute = hasLocationMoved(
        lastNavigationRerouteLocationRef.current,
        currentLocation,
        NAVIGATION_REROUTE_MIN_DELTA
      );

      if (!hasNeverRerouted && !intervalElapsed) return;
      if (!hasNeverRerouted && !movedSinceLastReroute) return;
    }

    navigationRerouteInFlightRef.current = true;
    setIsNavigationRerouting(true);

    try {
      await traceRouteBetween({
        start: currentLocation,
        end: destinationPoint,
        startLabel: "Current Position",
        endLabel: destination.label,
        name: `Route to ${destination.label}`,
        switchToDashboard: false,
        fitToRoute: false,
        silent: true,
      });
      lastNavigationRerouteAtRef.current = Date.now();
      lastNavigationRerouteLocationRef.current = currentLocation;
    } finally {
      navigationRerouteInFlightRef.current = false;
      setIsNavigationRerouting(false);
    }
  };

  const syncUserLocationOnMap = (
    map: mapboxgl.Map,
    location: { lat: number; lng: number },
    shouldRecenter = false,
    animateRecenter = true
  ) => {
    const center: [number, number] = [location.lng, location.lat];
    if (shouldRecenter) {
      if (animateRecenter) {
        map.flyTo({
          center,
          zoom: 13.2,
          pitch: 50,
          bearing: -20,
          essential: true,
        });
      } else {
        map.jumpTo({
          center,
          zoom: 13.2,
          pitch: 50,
          bearing: -20,
        });
      }
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(center);
      return;
    }

    const markerEl = document.createElement("div");
    markerEl.style.cssText =
      "width:14px;height:14px;background:#00F2FE;border:3px solid #fff;border-radius:50%;box-shadow:0 0 14px rgba(0,242,254,0.9);";
    userMarkerRef.current = new mapboxgl.Marker({ element: markerEl, anchor: "center" })
      .setLngLat(center)
      .addTo(map);
  };

  const commitUserLocation = (
    location: { lat: number; lng: number },
    source: LocationSource
  ) => {
    userLocationRef.current = location;
    setUserLocation(location);
    setLocationSource(source);
    setLocationTelemetry(`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
    if (source === "gps") {
      writeStorage(LAST_KNOWN_GPS_STORAGE_KEY, {
        lat: location.lat,
        lng: location.lng,
        savedAt: Date.now(),
      });
    }

    if (source === "fallback") setLocationLabel(FALLBACK_CITY_SECTOR_LABEL);
    if (source === "denied") setLocationLabel(`Location blocked - ${FALLBACK_CITY_SECTOR_LABEL}`);

    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      const atLiveReplayEdge =
        routeTrackingHistoryRef.current.length === 0 ||
        replayIndexRef.current >= routeTrackingHistoryRef.current.length - 1;
      const shouldFollow =
        source === "gps" &&
        atLiveReplayEdge &&
        (routeNavigationActiveRef.current || followMeEnabledRef.current);
      syncUserLocationOnMap(map, location, shouldFollow, source === "gps");
    }

    if (source === "gps") {
      void maybeRefreshNavigationRoute(location);
      setRouteTrackingHistory((previous) => {
        const lastPoint = previous[previous.length - 1];
        if (
          lastPoint &&
          !hasLocationMoved(lastPoint, location, GPS_MIN_DELTA)
        ) {
          return previous;
        }
        const nextPoint: TrackingPoint = {
          lat: location.lat,
          lng: location.lng,
          timestamp: Date.now(),
        };
        const nextHistory = [...previous, nextPoint];
        if (nextHistory.length > ROUTE_HISTORY_MAX_POINTS) {
          return nextHistory.slice(nextHistory.length - ROUTE_HISTORY_MAX_POINTS);
        }
        return nextHistory;
      });
    }
  };

  const addMapReport = (type: "radar" | "hazard", lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;

    const id = crypto.randomUUID();
    const isRadar = type === "radar";
    const label = isRadar ? "Police speed trap" : "Road hazard";

    const report: MapReport = {
      id,
      type,
      lat,
      lng,
      label,
      createdAt: Date.now(),
    };

    const pinEl = document.createElement("div");
    pinEl.style.cssText = isRadar
      ? "background:rgba(239,68,68,0.15);border:2px solid #ef4444;color:#fca5a5;padding:4px 8px;border-radius:6px;font-family:monospace;font-size:9px;font-weight:bold;box-shadow:0 0 10px rgba(239,68,68,0.5);cursor:pointer;"
      : "background:rgba(245,158,11,0.15);border:2px solid #f59e0b;color:#fde68a;padding:4px 8px;border-radius:6px;font-family:monospace;font-size:9px;font-weight:bold;box-shadow:0 0 10px rgba(245,158,11,0.5);cursor:pointer;";
    pinEl.innerHTML = isRadar ? "🚨 POLICE SPEED TRAP" : "⚠️ HAZARD REPORTED";

    const marker = new mapboxgl.Marker({ element: pinEl, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map);

    pinEl.addEventListener("click", (event) => {
      event.stopPropagation();
      removeMapReport(id);
    });

    reportMarkersRef.current.set(id, marker);
    setMapReports((previous) => [report, ...previous]);
    pushNotification({
      type: "report",
      text: `${label} reported at ${lat.toFixed(3)}, ${lng.toFixed(3)}.`,
    });
  };

  // Mount-only geolocation wiring: avoid re-registering watchPosition listeners.
  useEffect(() => {
    const cachedLocationRaw = readStorage<{
      lat?: number;
      lng?: number;
      savedAt?: number;
    }>(LAST_KNOWN_GPS_STORAGE_KEY);
    const hasRecentCachedLocation =
      typeof cachedLocationRaw?.lat === "number" &&
      typeof cachedLocationRaw?.lng === "number" &&
      Number.isFinite(cachedLocationRaw.lat) &&
      Number.isFinite(cachedLocationRaw.lng) &&
      typeof cachedLocationRaw.savedAt === "number" &&
      Date.now() - cachedLocationRaw.savedAt <= LAST_KNOWN_GPS_MAX_AGE_MS;
    let cachedLocation: { lat: number; lng: number } | null = null;
    if (hasRecentCachedLocation && cachedLocationRaw) {
      cachedLocation = {
        lat: cachedLocationRaw.lat as number,
        lng: cachedLocationRaw.lng as number,
      };
    }

    if (!navigator.geolocation) {
      if (cachedLocation) {
        commitUserLocation(cachedLocation, "fallback");
        setLocationLabel("Using last known location - GPS unavailable");
      } else {
        commitUserLocation(FALLBACK_LOCATION, "fallback");
        setLocationLabel(`Geolocation unavailable - ${FALLBACK_CITY_SECTOR_LABEL}`);
      }
      return;
    }

    let disposed = false;
    let hasGpsFix = false;

    if (cachedLocation) {
      commitUserLocation(cachedLocation, "fallback");
      setLocationLabel("Using last known location while acquiring GPS lock");
    }

    const fallbackTimer = window.setTimeout(() => {
      if (disposed || hasGpsFix) return;
      if (cachedLocation) {
        commitUserLocation(cachedLocation, "fallback");
        setLocationLabel("Waiting for GPS lock - using last known location");
      } else {
        commitUserLocation(FALLBACK_LOCATION, "fallback");
        setLocationLabel(`Waiting for GPS lock - ${FALLBACK_CITY_SECTOR_LABEL}`);
      }
    }, GPS_FALLBACK_TIMER_MS);

    const applyGpsFix = (position: GeolocationPosition) => {
      if (disposed) return;
      const nextLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      const previousLocation = userLocationRef.current;
      hasGpsFix = true;
      window.clearTimeout(fallbackTimer);
      if (
        hasLocationMoved(previousLocation, nextLocation, GPS_VISUAL_UPDATE_MIN_DELTA)
      ) {
        commitUserLocation(nextLocation, "gps");
      } else {
        setLocationSource("gps");
      }
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyGpsFix(position);
      },
      () => {
        // Ignore quick fix errors; watchPosition and fallback will handle resolution.
      },
      {
        enableHighAccuracy: false,
        timeout: QUICK_GPS_TIMEOUT_MS,
        maximumAge: GPS_WATCH_MAX_AGE_MS,
      }
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        applyGpsFix(position);
      },
      (error) => {
        if (disposed) return;
        if (error.code === 1) {
          window.clearTimeout(fallbackTimer);
          if (!hasGpsFix) {
            if (cachedLocation) {
              commitUserLocation(cachedLocation, "denied");
              setLocationLabel("Location blocked - using last known location");
            } else {
              commitUserLocation(FALLBACK_LOCATION, "denied");
            }
          }
        } else if (!hasGpsFix) {
          setLocationLabel("Searching for GPS lock...");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: GPS_WATCH_TIMEOUT_MS,
        maximumAge: GPS_WATCH_MAX_AGE_MS,
      }
    );

    return () => {
      disposed = true;
      window.clearTimeout(fallbackTimer);
      navigator.geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userLocation || locationSource !== "gps") return;
    const { lat, lng } = userLocation;
    const controller = new AbortController();

    async function resolvePlaceName() {
      if (!MAPBOX_TOKEN) {
        setLocationLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        return;
      }
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality,district,neighborhood&limit=1&access_token=${MAPBOX_TOKEN}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        const feature = data.features?.[0];
        const shortName = feature?.text ?? feature?.place_name?.split(",")[0];
        setLocationLabel(shortName ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      } catch {
        setLocationLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    }

    resolvePlaceName();
    return () => controller.abort();
  }, [locationSource, userLocation]);

  useEffect(() => {
    if (!canRenderSecureDashboard || !storageHydrated) return;
    let mapLoadTimeout: number | null = null;
    let mapHardLoadTimeout: number | null = null;
    const reportMarkers = reportMarkersRef.current;
    const friendMarkers = friendMarkersRef.current;
    setMapRuntimeIssue(null);
    setIsMapInteractionDisabled(false);
    setIsInteractiveMapReady(false);
    const timer = window.setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;
      const hasMapboxBasemapToken = Boolean(MAPBOX_BASEMAP_TOKEN);
      const shouldUseMapboxBasemap = ENABLE_MAPBOX_BASEMAP && hasMapboxBasemapToken;
      let usingFallbackBasemap = !shouldUseMapboxBasemap;
      let mapLoadCompleted = false;
      setIsUsingFallbackMap(usingFallbackBasemap);
      if (hasMapboxBasemapToken) {
        mapboxgl.accessToken = MAPBOX_BASEMAP_TOKEN;
      }

      if (!mapboxgl.supported({ failIfMajorPerformanceCaveat: false })) {
        setMapRuntimeIssue(
          "WebGL map rendering is unavailable in this browser. Showing static fallback map."
        );
        setIsMapInteractionDisabled(true);
        pushNotification({
          type: "system",
          text: "Interactive map unavailable in this browser. Showing static fallback map.",
        });
        return;
      }

      let map: mapboxgl.Map;
      try {
        map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: shouldUseMapboxBasemap ? MAPBOX_STYLE_URL : FALLBACK_BASEMAP_STYLE,
          center: [FALLBACK_LOCATION.lng, FALLBACK_LOCATION.lat],
          zoom: persistedMapZoom ?? DEFAULT_MAP_ZOOM,
          pitch: 50,
          bearing: -20,
          trackResize: true,
          antialias: true,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Map initialization failed unexpectedly.";
        setMapRuntimeIssue(
          "Interactive map could not initialize in this browser. Showing static fallback map."
        );
        setIsMapInteractionDisabled(true);
        pushNotification({
          type: "system",
          text: `Interactive map failed to initialize (${message}). Showing static fallback map.`,
        });
        return;
      }
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
      let mapReadyAttempts = 0;
      let interactionHandlersAttached = false;

      const confirmMapReady = () => {
        const currentMap = mapRef.current;
        const container = mapContainerRef.current;
        if (!currentMap || !container) return;

        currentMap.resize();
        mapReadyAttempts += 1;
        if (container.clientWidth < 16 || container.clientHeight < 16) {
          if (mapReadyAttempts < 30) {
            window.setTimeout(confirmMapReady, 120);
          }
          return;
        }

        setMapRuntimeIssue(null);
        setIsMapInteractionDisabled(false);
        setIsInteractiveMapReady(true);
      };

      mapHardLoadTimeout = window.setTimeout(() => {
        if (mapLoadCompleted) return;
        setMapRuntimeIssue(
          "Interactive map is loading slowly. Keeping fallback layer visible until it is ready."
        );
        setIsInteractiveMapReady(false);
        pushNotification({
          type: "system",
          text: "Interactive map is loading slowly. Waiting for map readiness.",
        });
      }, MAP_HARD_LOAD_TIMEOUT_MS);

      const switchToFallbackBasemap = (reason?: string) => {
        if (usingFallbackBasemap) return;
        usingFallbackBasemap = true;
        setIsUsingFallbackMap(true);
        setMapRuntimeIssue(null);
        map.setStyle(FALLBACK_BASEMAP_STYLE);
        pushNotification({
          type: "system",
          text:
            reason && reason.length > 120
              ? "Mapbox basemap unavailable. Switched to fallback map tiles."
              : reason
                ? `Mapbox basemap unavailable (${reason}). Switched to fallback map tiles.`
                : "Mapbox basemap unavailable. Switched to fallback map tiles.",
        });
      };

      mapLoadTimeout = window.setTimeout(() => {
        if (!shouldUseMapboxBasemap || usingFallbackBasemap || mapLoadCompleted) return;
        switchToFallbackBasemap("style load timeout");
      }, MAP_STYLE_LOAD_TIMEOUT_MS);

      map.on("error", (event) => {
        const eventError = event.error;
        const errorMessage =
          eventError instanceof Error
            ? eventError.message
            : typeof eventError === "string"
              ? eventError
              : "";
        const normalizedErrorMessage = errorMessage.toLowerCase();
        if (usingFallbackBasemap) {
          const hasTileFailure =
            /tile|raster|fetch|network|blocked|cors|403|404|429|500|failed/i.test(
              normalizedErrorMessage
            );
          if (hasTileFailure) {
            setMapRuntimeIssue(
              "Map tiles are having trouble loading. Retrying interactive map."
            );
          }
          return;
        }
        if (!shouldUseMapboxBasemap) return;
        const isCriticalStyleFailure =
          !mapLoadCompleted ||
          /access token|unauthorized|forbidden|401|403|styles:read|not authorized|invalid token|load failed|failed to fetch|network/i.test(
            normalizedErrorMessage
          );
        if (isCriticalStyleFailure) {
          switchToFallbackBasemap(errorMessage || undefined);
        }
      });

      map.on("load", () => {
        if (!mapLoadCompleted) {
          mapLoadCompleted = true;
          if (mapLoadTimeout != null) {
            window.clearTimeout(mapLoadTimeout);
            mapLoadTimeout = null;
          }
          if (mapHardLoadTimeout != null) {
            window.clearTimeout(mapHardLoadTimeout);
            mapHardLoadTimeout = null;
          }
        }

        mapReadyAttempts = 0;
        confirmMapReady();

        if (userLocationRef.current) {
          syncUserLocationOnMap(map, userLocationRef.current, true, false);
        }

        const replayHistory = routeTrackingHistoryRef.current;
        const replayFrame = replayIndexRef.current;
        if (replayHistory.length >= 2) {
          upsertDriveReplayTrail(map, replayHistory, replayFrame);
        }

        if (interactionHandlersAttached) return;
        interactionHandlersAttached = true;

        map.on("zoomend", () => {
          if (!storagePrefix) return;
          writeStorage(
            `${storagePrefix}${STORAGE_KEYS.mapZoom}`,
            Number(map.getZoom().toFixed(2))
          );
        });

        map.on("click", (event) => {
          const { lng, lat } = event.lngLat;

          if (routePinModeRef.current) {
            void setRoutePinAtLocation(lat, lng);
            return;
          }

          const menuEl = document.createElement("div");
          menuEl.style.cssText =
            "background:#111215;border:1px solid rgba(255,255,255,0.08);padding:10px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:6px;pointer-events:auto;z-index:999;";

          const label = document.createElement("div");
          label.style.cssText =
            "font-family:monospace;font-size:8px;color:#6b7280;font-weight:bold;text-transform:uppercase;margin-bottom:2px;";
          label.innerHTML = "Road Report";
          menuEl.appendChild(label);

          const createReportButton = (
            text: string,
            color: string,
            bg: string,
            border: string
          ) => {
            const button = document.createElement("button");
            button.style.cssText = `background:${bg};border:1px solid ${border};color:${color};padding:4px 8px;border-radius:6px;font-family:monospace;font-size:9px;font-weight:bold;text-align:left;cursor:pointer;`;
            button.innerHTML = text;
            return button;
          };

          const radarButton = createReportButton(
            "🚨 POLICE / COP ALERT",
            "#fca5a5",
            "rgba(239,68,68,0.1)",
            "rgba(239,68,68,0.2)"
          );
          const hazardButton = createReportButton(
            "⚠️ ROAD HAZARD",
            "#fde68a",
            "rgba(245,158,11,0.1)",
            "rgba(245,158,11,0.2)"
          );
          const closeButton = createReportButton(
            "❌ CANCEL",
            "#9ca3af",
            "rgba(255,255,255,0.02)",
            "rgba(255,255,255,0.05)"
          );

          menuEl.appendChild(radarButton);
          menuEl.appendChild(hazardButton);
          menuEl.appendChild(closeButton);

          const menuMarker = new mapboxgl.Marker({ element: menuEl, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map);

          closeButton.addEventListener("click", (clickEvent) => {
            clickEvent.stopPropagation();
            menuMarker.remove();
          });

          radarButton.addEventListener("click", (clickEvent) => {
            clickEvent.stopPropagation();
            menuMarker.remove();
            addMapReport("radar", lat, lng);
          });

          hazardButton.addEventListener("click", (clickEvent) => {
            clickEvent.stopPropagation();
            menuMarker.remove();
            addMapReport("hazard", lat, lng);
          });
        });
      });

      map.on("style.load", () => {
        mapReadyAttempts = 0;
        confirmMapReady();
      });
    }, 0);

    return () => {
      setIsInteractiveMapReady(false);
      window.clearTimeout(timer);
      if (mapLoadTimeout != null) {
        window.clearTimeout(mapLoadTimeout);
      }
      if (mapHardLoadTimeout != null) {
        window.clearTimeout(mapHardLoadTimeout);
      }
      reportMarkers.forEach((marker) => marker.remove());
      reportMarkers.clear();
      friendMarkers.forEach((marker) => marker.remove());
      friendMarkers.clear();
      clearRouteVisualization(true);
      routePinMarkerRef.current?.remove();
      routePinMarkerRef.current = null;
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Initialize map when authenticated dashboard view is renderable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRenderSecureDashboard, persistedMapZoom, storageHydrated]);

  useEffect(() => {
    if (activeTab !== "dashboard" || !mapRef.current) return;
    const resizeMap = () => mapRef.current?.resize();
    const timers = [50, 200, 500, 1000].map((delay) => window.setTimeout(resizeMap, delay));
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [activeTab, isInteractiveMapReady]);

  useEffect(() => {
    if (!isInteractiveMapReady || !mapContainerRef.current) return;
    const map = mapRef.current;
    const container = mapContainerRef.current;
    const resizeMap = () => map?.resize();
    resizeMap();
    const resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(container);
    window.addEventListener("orientationchange", resizeMap);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("orientationchange", resizeMap);
    };
  }, [isInteractiveMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !isInteractiveMapReady ||
      isMapInteractionUnavailable ||
      !isFriendLayerVisible
    ) {
      friendMarkersRef.current.forEach((marker) => marker.remove());
      friendMarkersRef.current.clear();
      return;
    }

    if (friendMapPresence.length === 0) {
      friendMarkersRef.current.forEach((marker) => marker.remove());
      friendMarkersRef.current.clear();
      return;
    }

    const activeFriendIds = new Set(
      friendMapPresence.map((presence) => presence.friendId)
    );

    friendMarkersRef.current.forEach((marker, friendId) => {
      if (!activeFriendIds.has(friendId)) {
        marker.remove();
        friendMarkersRef.current.delete(friendId);
      }
    });

    friendMapPresence.forEach((presence) => {
      const existingMarker = friendMarkersRef.current.get(presence.friendId);
      if (existingMarker) {
        existingMarker.setLngLat([presence.lng, presence.lat]);
        existingMarker
          .getElement()
          .setAttribute("title", `${presence.handle} • ${presence.activityLabel}`);
        return;
      }

      const markerEl = document.createElement("button");
      markerEl.type = "button";
      markerEl.setAttribute("aria-label", `${presence.handle} location marker`);
      markerEl.title = `${presence.handle} • ${presence.activityLabel}`;
      const accentColor = presence.activityType === "meet" ? "#f59e0b" : "#00F2FE";
      markerEl.style.cssText = `width:24px;height:24px;background:rgba(17,18,21,0.95);border:2px solid ${accentColor};border-radius:50%;display:flex;align-items:center;justify-content:center;color:${accentColor};font-family:monospace;font-size:9px;font-weight:bold;box-shadow:0 0 12px ${accentColor}55;cursor:pointer;`;
      const markerText = presence.handle.slice(0, 2).toUpperCase();
      markerEl.textContent = markerText || "FR";
      const marker = new mapboxgl.Marker({ element: markerEl, anchor: "center" })
        .setLngLat([presence.lng, presence.lat])
        .addTo(map);
      markerEl.addEventListener("click", (event) => {
        event.stopPropagation();
        const currentPoint = marker.getLngLat();
        map.flyTo({
          center: [currentPoint.lng, currentPoint.lat],
          zoom: 13.2,
          essential: true,
        });
        setSelectedFriendId(presence.friendId);
      });
      friendMarkersRef.current.set(presence.friendId, marker);
    });
  }, [
    friendMapPresence,
    isFriendLayerVisible,
    isInteractiveMapReady,
    isMapInteractionUnavailable,
  ]);

  useEffect(() => {
    if (!isMapInteractionDisabled) return;
    setIsUsingFallbackMap(true);
    setIsInteractiveMapReady(false);
    clearRouteVisualization(true);
    setPendingRoutePin(null);
    setIsRoutePinMode(false);
    routePinModeRef.current = false;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    friendMarkersRef.current.forEach((marker) => marker.remove());
    friendMarkersRef.current.clear();
    routePinMarkerRef.current?.remove();
    routePinMarkerRef.current = null;
    routeStartMarkerRef.current?.remove();
    routeStartMarkerRef.current = null;
    routeEndMarkerRef.current?.remove();
    routeEndMarkerRef.current = null;
  }, [isMapInteractionDisabled]);

  useEffect(() => {
    if (!userLocation) return;
    const { lat, lng } = userLocation;

    async function fetchWeather() {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`
        );
        const data = await response.json();
        const tempF = data?.current?.temperature_2m;
        const weatherCode = data?.current?.weather_code;
        if (tempF != null && weatherCode != null) {
          const surface = surfaceStatusFromWeatherCode(weatherCode);
          setWeatherCondition(`${surface.label} (${Math.round(tempF)}°F)`);
          setAsphaltRisk(surface.risk);
        } else {
          setWeatherCondition("Weather telemetry unavailable");
          setAsphaltRisk("caution");
        }
      } catch {
        setWeatherCondition("Weather telemetry unavailable");
        setAsphaltRisk("caution");
      }
    }

    fetchWeather();
    const interval = window.setInterval(fetchWeather, 300000);
    return () => window.clearInterval(interval);
  }, [userLocation]);

  const handleConvoyInviteRequest = (id: number) => {
    let convoyName = "Selected convoy";
    setConvoys((previous) =>
      previous.map((convoy) => {
        if (convoy.id !== id) return convoy;
        convoyName = convoy.title;
        if (convoy.status !== "Joinable") return convoy;
        return {
          ...convoy,
          status: "Pending",
          members: Math.min(convoy.members + 1, convoy.capacity),
        };
      })
    );
    pushNotification({
      type: "convoy",
      text: `Invitation request submitted for ${convoyName}.`,
    });
  };

  const handleConvoyPasscodeJoin = (id: number) => {
    const enteredCode = (passcodeInputs[id] ?? "").trim().toUpperCase();
    if (!enteredCode) {
      pushNotification({
        type: "convoy",
        text: "Passcode required before joining this convoy.",
      });
      return;
    }

    let matched = false;
    let convoyName = "Selected convoy";

    setConvoys((previous) =>
      previous.map((convoy) => {
        if (convoy.id !== id) return convoy;
        convoyName = convoy.title;
        if (convoy.passcode?.toUpperCase() === enteredCode && convoy.status === "Joinable") {
          matched = true;
          return {
            ...convoy,
            status: "Approved",
            members: Math.min(convoy.members + 1, convoy.capacity),
          };
        }
        return convoy;
      })
    );

    setPasscodeInputs((previous) => ({ ...previous, [id]: "" }));

    if (matched) {
      pushNotification({
        type: "convoy",
        text: `Passcode accepted. You're in ${convoyName}.`,
      });
      return;
    }

    pushNotification({
      type: "convoy",
      text: `Invalid passcode for ${convoyName}.`,
    });
  };

  const handleCreateConvoy = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManagePrivateConvoys) {
      openTierGateModal(
        "Hosting private group drives and exclusive events requires Convoy Commander tier."
      );
      return;
    }
    const trimmedTitle = convoyForm.title.trim();
    const trimmedRoute = convoyForm.route.trim();
    const trimmedPasscode = convoyForm.passcode.trim();

    if (!trimmedTitle || !trimmedRoute || !convoyForm.departureAt) return;
    if (convoyForm.joinMode === "passcode" && trimmedPasscode.length < 4) {
      pushNotification({
        type: "convoy",
        text: "Passcode convoys require at least a 4-character passcode.",
      });
      return;
    }

    const newConvoy: Convoy = {
      id: Date.now(),
      title: trimmedTitle,
      route: trimmedRoute,
      departureAt: new Date(convoyForm.departureAt).toISOString(),
      capacity: Math.max(convoyForm.capacity, 2),
      members: 1,
      status: "Approved",
      joinMode: convoyForm.joinMode,
      passcode: convoyForm.joinMode === "passcode" ? trimmedPasscode : undefined,
      host: profileForm.displayName || "You",
    };

    setConvoys((previous) => [newConvoy, ...previous]);
    setIsCreateConvoyOpen(false);
    setConvoyForm({
      title: "",
      route: "",
      departureAt: "",
      capacity: 10,
      joinMode: "invite",
      passcode: "",
    });

    pushNotification({
      type: "convoy",
      text: `Private convoy "${newConvoy.title}" is now live.`,
    });
  };

  const handleVehicleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setVehicleForm((previous) => ({ ...previous, imageUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const openTierGateModal = (message: string) => {
    setTierGateMessage(message);
    setIsTierGateModalOpen(true);
  };

  const handleExportDriveStatistics = () => {
    const payload = {
      tier: effectiveUserTier,
      exportedAt: new Date().toISOString(),
      statistics: replayStatistics,
      replayProgressPercent,
      routePoints: routeTrackingHistory.length,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `apex-drive-stats-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    pushNotification({
      type: "system",
      text: "Drive statistics exported successfully.",
    });
  };

  const handleClearRouteReplay = () => {
    if (routeTrackingHistory.length === 0) return;

    const confirmed = window.confirm(
      "Clear this post-drive replay and remove all recorded GPS points?"
    );
    if (!confirmed) return;

    setRouteTrackingHistory([]);
    setReplayIndex(0);
    setIsReplayScrubbing(false);
    replayMarkerRef.current?.remove();
    replayMarkerRef.current = null;

    const map = mapRef.current;
    if (map?.isStyleLoaded()) {
      clearDriveReplayTrail(map);
    }

    if (storagePrefix) {
      writeStorage(`${storagePrefix}${STORAGE_KEYS.routeReplay}`, []);
    }

    pushNotification({
      type: "system",
      text: "Post-drive replay cleared.",
    });
  };

  const handleReplayIndexChange = (nextIndex: number) => {
    const maxIndex = Math.max(routeTrackingHistory.length - 1, 0);
    setReplayIndex(Math.max(0, Math.min(nextIndex, maxIndex)));
  };

  const handleAddVehicleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!vehicleForm.year || !vehicleForm.make || !vehicleForm.model || !vehicleForm.nickname) {
      return;
    }

    if (isGarageAtCapacity) {
      openTierGateModal(
        effectiveUserTier === "free"
          ? "Free tier is capped at 2 vehicle slots. Upgrade to Apex Interceptor for 5 slots or Convoy Commander for unlimited garage capacity."
          : "Interceptor tier is capped at 5 vehicle slots. Upgrade to Convoy Commander for unlimited garage capacity."
      );
      return;
    }

    const newVehicle: Vehicle = {
      id: Date.now(),
      nickname: vehicleForm.nickname.trim(),
      year: vehicleForm.year.trim(),
      make: vehicleForm.make.trim(),
      model: vehicleForm.model.trim(),
      horsepower: vehicleForm.horsepower.trim() || "N/A",
      modifications: vehicleForm.modifications.trim() || "Stock",
      imageUrl: vehicleForm.imageUrl,
      ref: `ASSET-${String(vehicles.length + 1).padStart(2, "0")}`,
    };

    setVehicles((previous) => [newVehicle, ...previous]);
    setVehicleForm({
      nickname: "",
      year: "",
      make: "",
      model: "",
      horsepower: "",
      modifications: "",
      imageUrl: "",
    });
    setIsVehicleModalOpen(false);

    pushNotification({
      type: "system",
      text: `${newVehicle.nickname} saved to your digital garage.`,
    });
  };

  const handleRemoveVehicle = (vehicleId: number) => {
    let removedName = "Vehicle";
    setVehicles((previous) =>
      previous.filter((vehicle) => {
        if (vehicle.id === vehicleId) removedName = vehicle.nickname;
        return vehicle.id !== vehicleId;
      })
    );
    pushNotification({
      type: "system",
      text: `${removedName} removed from your digital garage.`,
    });
  };

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsProfileSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profileForm,
          tier: effectiveUserTier,
          avatarUrl: profileImageUrl || null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        profile?: Partial<ProfileFormState>;
        avatarUrl?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save profile.");
      }

      if (payload.profile && typeof payload.profile === "object") {
        setProfileForm((previous) => ({
          ...previous,
          ...payload.profile,
          tier: effectiveUserTier,
        }));
      }

      if (typeof payload.avatarUrl === "string") {
        setProfileImageUrl(payload.avatarUrl);
      }

      pushNotification({
        type: "system",
        text: "Profile saved to your Apex Drive account.",
      });
    } catch (error) {
      pushNotification({
        type: "system",
        text: error instanceof Error ? error.message : "Could not save profile.",
      });
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleClubToggle = (id: number) => {
    let clubName = "Club";
    let joined = false;
    setClubs((previous) =>
      previous.map((club) => {
        if (club.id !== id) return club;
        clubName = club.name;
        joined = !club.isMember;
        return {
          ...club,
          isMember: !club.isMember,
          members: club.isMember ? Math.max(1, club.members - 1) : club.members + 1,
        };
      })
    );

    pushNotification({
      type: "club",
      text: joined ? `You joined ${clubName}.` : `You left ${clubName}.`,
    });
  };

  const handleCreateClub = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clubForm.name.trim() || !clubForm.city.trim()) return;

    const newClub: Club = {
      id: Date.now(),
      name: clubForm.name.trim(),
      city: clubForm.city.trim(),
      description: clubForm.description.trim() || "Community-run driving club.",
      organizer: profileForm.displayName || "Independent Organizer",
      members: 1,
      isMember: true,
    };

    setClubs((previous) => [newClub, ...previous]);
    setClubForm({ name: "", city: "", description: "" });
    pushNotification({
      type: "club",
      text: `Club "${newClub.name}" has been created.`,
    });
  };

  const handleMeetToggle = (id: number) => {
    let meetName = "Meet";
    let attending = false;
    setMeets((previous) =>
      previous.map((meet) => {
        if (meet.id !== id) return meet;
        meetName = meet.title;
        attending = !meet.isGoing;
        return {
          ...meet,
          isGoing: !meet.isGoing,
          attendees: meet.isGoing ? Math.max(1, meet.attendees - 1) : meet.attendees + 1,
        };
      })
    );

    pushNotification({
      type: "club",
      text: attending ? `RSVP confirmed for ${meetName}.` : `RSVP removed for ${meetName}.`,
    });
  };

  const requestFriendConnection = (handle: string, sourceLabel: string) => {
    const normalizedHandle = handle.trim();
    if (!normalizedHandle) return;
    if (normalizedHandle.toLowerCase() === profileForm.displayName.trim().toLowerCase()) {
      return;
    }

    const contactId = makeCommunityContactId(normalizedHandle);
    if (friendIds.has(contactId)) {
      pushNotification({
        type: "friend",
        text: `${normalizedHandle} is already in your friends list.`,
      });
      return;
    }
    if (pendingFriendRequestContactIds.has(contactId)) {
      pushNotification({
        type: "friend",
        text: `Friend request to ${normalizedHandle} is still pending.`,
      });
      return;
    }

    setFriendRequests((previous) => [
      {
        id: crypto.randomUUID(),
        contactId,
        handle: normalizedHandle,
        sourceLabel,
        createdAt: Date.now(),
      },
      ...previous,
    ]);

    pushNotification({
      type: "friend",
      text: `Friend request sent to ${normalizedHandle}.`,
    });
  };

  const acceptFriendRequest = (requestId: string) => {
    const request = friendRequests.find((entry) => entry.id === requestId);
    if (!request) return;

    setFriendRequests((previous) => previous.filter((entry) => entry.id !== requestId));
    setFriends((previous) => {
      if (previous.some((friend) => friend.id === request.contactId)) return previous;
      return [
        {
          id: request.contactId,
          handle: request.handle,
          sourceLabel: request.sourceLabel,
          connectedAt: Date.now(),
        },
        ...previous,
      ];
    });
    setDirectMessages((previous) => {
      if (previous[request.contactId]) return previous;
      return { ...previous, [request.contactId]: [] };
    });
    setSelectedFriendId(request.contactId);

    pushNotification({
      type: "friend",
      text: `${request.handle} accepted your friend request.`,
    });
  };

  const cancelFriendRequest = (requestId: string) => {
    const request = friendRequests.find((entry) => entry.id === requestId);
    if (!request) return;
    setFriendRequests((previous) => previous.filter((entry) => entry.id !== requestId));
    pushNotification({
      type: "friend",
      text: `Friend request to ${request.handle} cancelled.`,
    });
  };

  const sendDirectMessageToFriend = (friendId: string) => {
    const draft = (messageDrafts[friendId] ?? "").trim();
    if (!draft) return;
    const outboundMessage: DirectMessage = {
      id: crypto.randomUUID(),
      sender: "me",
      text: draft,
      createdAt: Date.now(),
    };

    setDirectMessages((previous) => {
      const thread = previous[friendId] ?? [];
      return {
        ...previous,
        [friendId]: [...thread, outboundMessage].slice(-40),
      };
    });
    setMessageDrafts((previous) => ({ ...previous, [friendId]: "" }));

    // Simulate a lightweight acknowledgement for local demo messaging.
    window.setTimeout(() => {
      const replyMessage: DirectMessage = {
        id: crypto.randomUUID(),
        sender: "friend",
        text: "Received. Catch you at the next run.",
        createdAt: Date.now(),
      };
      setDirectMessages((previous) => {
        const thread = previous[friendId] ?? [];
        return {
          ...previous,
          [friendId]: [...thread, replyMessage].slice(-40),
        };
      });
    }, 900);
  };

  const removeFriend = (friendId: string) => {
    const friend = friends.find((entry) => entry.id === friendId);
    setFriends((previous) => previous.filter((entry) => entry.id !== friendId));
    setSelectedFriendId((previous) => (previous === friendId ? null : previous));
    setDirectMessages((previous) => {
      if (!previous[friendId]) return previous;
      const next = { ...previous };
      delete next[friendId];
      return next;
    });
    setMessageDrafts((previous) => {
      if (!(friendId in previous)) return previous;
      const next = { ...previous };
      delete next[friendId];
      return next;
    });
    if (friend) {
      pushNotification({
        type: "friend",
        text: `${friend.handle} removed from your friends list.`,
      });
    }
  };

  const handleHostMeet = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!meetForm.title.trim() || !meetForm.location.trim() || !meetForm.date) return;

    const newMeet: Meet = {
      id: Date.now(),
      title: meetForm.title.trim(),
      location: meetForm.location.trim(),
      date: new Date(meetForm.date).toISOString(),
      club: meetForm.club.trim() || "Independent Hosts",
      host: profileForm.displayName || "You",
      attendees: 1,
      isGoing: true,
    };

    setMeets((previous) => [newMeet, ...previous]);
    setMeetForm({ title: "", location: "", date: "", club: "" });
    pushNotification({
      type: "club",
      text: `New meet "${newMeet.title}" has been scheduled.`,
    });
  };

  const handleSubmitRouteProposal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = routeSubmissionForm.name.trim();
    const trimmedStart = routeSubmissionForm.startLabel.trim();
    const trimmedEnd = routeSubmissionForm.endLabel.trim();
    const trimmedNotes = routeSubmissionForm.notes.trim();
    if (!trimmedName || !trimmedStart || !trimmedEnd) return;

    try {
      const response = await fetch("/api/routes/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          startLabel: trimmedStart,
          endLabel: trimmedEnd,
          notes: trimmedNotes,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        submission?: RouteSubmission;
        error?: string;
      };

      if (!response.ok || !payload.submission) {
        throw new Error(payload.error ?? "Could not submit route for approval.");
      }

      setRouteSubmissions((previous) => {
        const submission = {
          ...payload.submission!,
          isOwn: true,
        };
        const withoutDuplicate = previous.filter((entry) => entry.id !== submission.id);
        return [submission, ...withoutDuplicate];
      });
      setRouteSubmissionForm({
        name: "",
        startLabel: "",
        endLabel: "",
        notes: "",
      });
      pushNotification({
        type: "system",
        text: `Route proposal "${payload.submission.name}" submitted for approval.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not submit route for approval.";
      pushNotification({
        type: "system",
        text: message,
      });
    }
  };

  const moderateRouteSubmission = async (
    submissionId: string,
    action: "approve" | "reject"
  ) => {
    if (!isRouteModerator) return;

    try {
      const response = await fetch(`/api/admin/moderation/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        submission?: RouteSubmission;
        error?: string;
      };

      if (!response.ok || !payload.submission) {
        throw new Error(payload.error ?? "Could not update route submission.");
      }

      setRouteSubmissions((previous) =>
        previous.map((submission) =>
          submission.id === submissionId ? payload.submission! : submission
        )
      );
      pushNotification({
        type: "system",
        text: `${payload.submission.name} ${action === "approve" ? "approved" : "rejected"}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update route submission.";
      pushNotification({
        type: "system",
        text: message,
      });
    }
  };

  const approveRouteSubmission = (submissionId: string) => {
    void moderateRouteSubmission(submissionId, "approve");
  };

  const rejectRouteSubmission = (submissionId: string) => {
    void moderateRouteSubmission(submissionId, "reject");
  };

  const getRouteStartDistanceMiles = (route: RoutePreset): number | null => {
    if (!userLocationRef.current) return null;
    return distanceMilesBetween(userLocationRef.current, {
      lat: route.start.lat,
      lng: route.start.lng,
    });
  };

  const guideToRouteStart = (route: RoutePreset) => {
    setSelectedRouteId(route.id);
    if (!userLocationRef.current) {
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [route.start.lng, route.start.lat],
          zoom: 11.8,
          pitch: 50,
          bearing: -20,
          essential: true,
        });
      }
      setActiveTab("dashboard");
      pushNotification({
        type: "system",
        text: `${route.name} start highlighted. Waiting for GPS lock to build route-to-start guidance.`,
      });
      return;
    }

    traceRouteBetween({
      start: userLocationRef.current,
      end: { lat: route.start.lat, lng: route.start.lng },
      startLabel: "Current Position",
      endLabel: route.start.label,
      name: `Get to ${route.name} Start`,
    });
  };

  const startPresetRouteFocus = async (route: RoutePreset) => {
    setSelectedRouteId(route.id);
    if (!userLocationRef.current) {
      pushNotification({
        type: "system",
        text: "Waiting for your live location before starting this route focus.",
      });
      return;
    }

    const distanceToStart = getRouteStartDistanceMiles(route);
    if (distanceToStart == null || distanceToStart > ROUTE_START_READY_RADIUS_MILES) {
      const distanceLabel =
        distanceToStart == null
          ? "still acquiring your GPS location"
          : `${formatRouteDistance(distanceToStart)} away`;
      pushNotification({
        type: "system",
        text: `You are ${distanceLabel} from ${route.start.label}. Tap "Get Me There" first.`,
      });
      return;
    }

    await traceRouteBetween({
      start: { lat: route.start.lat, lng: route.start.lng },
      end: { lat: route.end.lat, lng: route.end.lng },
      startLabel: route.start.label,
      endLabel: route.end.label,
      name: route.name,
    });
  };

  const traceRouteToPinnedPoint = async () => {
    if (!pendingRoutePin) {
      pushNotification({
        type: "system",
        text: "Drop a route pin first.",
      });
      return;
    }
    if (!userLocationRef.current) {
      pushNotification({
        type: "system",
        text: "Waiting for your GPS location before tracing route.",
      });
      return;
    }

    await traceRouteBetween({
      start: userLocationRef.current,
      end: { lat: pendingRoutePin.lat, lng: pendingRoutePin.lng },
      startLabel: "Current Position",
      endLabel: pendingRoutePin.label,
      name: `Pinned Route to ${pendingRoutePin.label}`,
    });
  };

  const startRouteNavigation = () => {
    if (!activeRoute) {
      pushNotification({
        type: "system",
        text: "Trace or load a route before starting navigation.",
      });
      return;
    }

    const currentLocation = userLocationRef.current;
    if (!currentLocation) {
      pushNotification({
        type: "system",
        text: "Waiting for your location before starting route navigation.",
      });
      return;
    }

    const destination = {
      lat: activeRoute.end.lat,
      lng: activeRoute.end.lng,
      label: activeRoute.end.label,
    };
    setNavigationDestination(destination);
    routeNavigationActiveRef.current = true;
    setIsRouteNavigationActive(true);
    setIsRoutePanelCollapsed(true);
    resetNavigationRerouteState();
    setActiveTab("dashboard");
    if (locationSource !== "gps") {
      pushNotification({
        type: "system",
        text:
          "Route navigation started from your current sector. Live rerouting begins when GPS lock is available.",
      });
    } else {
      pushNotification({
        type: "system",
        text: `Started route navigation to ${destination.label}.`,
      });
    }

    const map = mapRef.current;
    if (map) {
      if (map.isStyleLoaded()) {
        syncUserLocationOnMap(map, currentLocation, true, true);
      } else {
        map.once("load", () => {
          if (!userLocationRef.current) return;
          syncUserLocationOnMap(map, userLocationRef.current, true, true);
        });
      }
    }

    void maybeRefreshNavigationRoute(currentLocation, {
      force: true,
      destinationOverride: destination,
    });
  };

  const saveActiveRouteToFavorites = () => {
    if (!activeRoute) {
      pushNotification({
        type: "system",
        text: "Trace a route first, then save it to favorites.",
      });
      return;
    }

    const routeName = favoriteRouteName.trim() || activeRoute.name;
    const favoriteRoute: TracedRoute = {
      ...activeRoute,
      id: crypto.randomUUID(),
      name: routeName,
    };
    setFavoriteRoutes((previous) => [favoriteRoute, ...previous]);
    setFavoriteRouteName("");
    pushNotification({
      type: "system",
      text: `"${routeName}" saved to favorite routes.`,
    });
  };

  const loadFavoriteRoute = async (route: TracedRoute) => {
    await traceRouteBetween({
      start: { lat: route.start.lat, lng: route.start.lng },
      end: { lat: route.end.lat, lng: route.end.lng },
      startLabel: route.start.label,
      endLabel: route.end.label,
      name: route.name,
    });
  };

  const removeFavoriteRoute = (routeId: string) => {
    setFavoriteRoutes((previous) => previous.filter((route) => route.id !== routeId));
  };

  const startSubscriptionCheckout = async (planOverride?: SubscriptionPlan) => {
    const selectedPlan = planOverride ?? subscriptionForm.plan;
    const billingEmail =
      profileForm.email.trim() ||
      user?.primaryEmailAddress?.emailAddress?.trim() ||
      subscriptionForm.billingEmail.trim();

    if (!billingEmail) {
      pushNotification({
        type: "system",
        text: "Add your email in profile settings before starting checkout.",
      });
      return;
    }

    if (selectedPlan === "starter") {
      if (stripeBilling.customerId) {
        await openBillingPortal();
        return;
      }
      pushNotification({
        type: "system",
        text: "You're already on the free plan.",
      });
      return;
    }

    setSubscriptionForm((previous) => ({
      ...previous,
      plan: selectedPlan,
      billingEmail,
    }));
    setIsCheckoutLoading(true);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Could not start checkout.");
      }

      window.location.href = payload.url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start checkout.";
      pushNotification({
        type: "system",
        text: message,
      });
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const openBillingPortal = async () => {
    if (!stripeBilling.customerId) {
      pushNotification({
        type: "system",
        text: "No billing profile found yet. Subscribe to a paid plan first.",
      });
      return;
    }

    setIsBillingPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Could not open billing portal.");
      }

      window.location.href = payload.url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open billing portal.";
      pushNotification({
        type: "system",
        text: message,
      });
    } finally {
      setIsBillingPortalLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleteAccountLoading(true);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Could not delete account.");
      }

      setIsDeleteAccountModalOpen(false);
      window.location.href = "/sign-in";
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not delete account.";
      pushNotification({
        type: "system",
        text: message,
      });
    } finally {
      setIsDeleteAccountLoading(false);
    }
  };

  const centerMapOnUser = () => {
    if (isMapInteractionUnavailable) {
      pushNotification({
        type: "system",
        text: "Interactive map is unavailable in this browser session.",
      });
      return;
    }
    const map = mapRef.current;
    if (!map || !userLocationRef.current) {
      pushNotification({
        type: "system",
        text: "User location unavailable. Waiting for GPS fix.",
      });
      return;
    }
    const nextLocation = userLocationRef.current;
    if (!map.isStyleLoaded()) {
      pushNotification({
        type: "system",
        text: "Map is still initializing. Will recenter when ready.",
      });
      map.once("load", () => {
        if (!userLocationRef.current) return;
        syncUserLocationOnMap(map, userLocationRef.current, true, true);
      });
    } else {
      syncUserLocationOnMap(map, nextLocation, true, true);
    }
    setActiveTab("dashboard");
  };

  const toggleFollowMe = () => {
    const next = !isFollowMeEnabled;
    setIsFollowMeEnabled(next);
    if (!next) return;

    const map = mapRef.current;
    const location = userLocationRef.current;
    if (!map || !location) return;
    if (map.isStyleLoaded()) {
      syncUserLocationOnMap(map, location, true, true);
    } else {
      map.once("load", () => {
        if (!userLocationRef.current) return;
        syncUserLocationOnMap(map, userLocationRef.current, true, true);
      });
    }
  };

  const handleSearchResultSelect = (result: SearchResult) => {
    setActiveTab(result.tab);
    setSearchQuery("");
    setIsSearchResultsOpen(false);
    setIsNotificationOpen(false);
  };

  const renderConvoyAction = (convoy: Convoy, compact = false) => {
    if (convoy.status === "Approved") {
      return (
        <div className="w-full mt-4 bg-white/[0.02] border border-white/5 text-gray-300 text-center py-2.5 rounded-xl text-xs font-mono uppercase flex items-center justify-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400" /> Access Key Loaded
        </div>
      );
    }

    if (convoy.status === "Pending") {
      return (
        <div className="w-full mt-4 bg-white/[0.02] border border-white/5 text-gray-300 text-center py-2.5 rounded-xl text-xs font-mono uppercase flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400" /> Awaiting Host Clearance
        </div>
      );
    }

    if (convoy.joinMode === "invite") {
      return (
        <button
          onClick={() => handleConvoyInviteRequest(convoy.id)}
          className="w-full mt-4 bg-[#00F2FE] text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-90 transition-all font-mono uppercase tracking-wider"
        >
          Request Invitation
        </button>
      );
    }

    return (
      <div className={`mt-4 ${compact ? "space-y-2" : "grid grid-cols-3 gap-2"}`}>
        <input
          type="text"
          placeholder="Passcode"
          value={passcodeInputs[convoy.id] ?? ""}
          onChange={(event) =>
            setPasscodeInputs((previous) => ({
              ...previous,
              [convoy.id]: event.target.value,
            }))
          }
          className={`${
            compact ? "w-full" : "col-span-2"
          } bg-[#16171b] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none font-mono uppercase`}
        />
        <button
          onClick={() => handleConvoyPasscodeJoin(convoy.id)}
          className={`${
            compact ? "w-full" : "col-span-1"
          } bg-[#00F2FE] text-black font-bold py-2 rounded-xl text-[10px] hover:opacity-90 transition-all font-mono uppercase tracking-wider`}
        >
          Join
        </button>
      </div>
    );
  };

  if (!isUserLoaded) {
    return (
      <main className="min-h-screen w-full bg-[#0d0e10] flex items-center justify-center text-gray-300">
        <p className="text-sm font-mono uppercase tracking-wide">Loading secure access...</p>
      </main>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  if (!hasVerifiedEmail || !isPhoneVerificationSatisfied) {
    return (
      <main className="min-h-screen w-full bg-[#0d0e10] flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-[#111215] border border-white/10 rounded-2xl p-8 shadow-xl space-y-5">
          <h1 className="text-lg font-bold text-white uppercase tracking-wide">
            Verify Your Account
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            Apex Drive requires a verified email. Phone verification is only required
            after a phone number is added to your Clerk account.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-[#16171b] rounded-xl px-3 py-2 border border-white/5">
              <span className="text-xs font-mono text-gray-300 uppercase">Email Verification</span>
              <span className={`text-xs font-mono uppercase ${hasVerifiedEmail ? "text-emerald-400" : "text-amber-400"}`}>
                {hasVerifiedEmail ? "Verified" : "Pending"}
              </span>
            </div>
            <div className="flex items-center justify-between bg-[#16171b] rounded-xl px-3 py-2 border border-white/5">
              <span className="text-xs font-mono text-gray-300 uppercase">Phone Verification</span>
              <span
                className={`text-xs font-mono uppercase ${
                  hasVerifiedPhone
                    ? "text-emerald-400"
                    : hasAnyPhoneNumber
                      ? "text-amber-400"
                      : "text-gray-500"
                }`}
              >
                {hasVerifiedPhone
                  ? "Verified"
                  : hasAnyPhoneNumber
                    ? "Pending"
                    : "Not Added"}
              </span>
            </div>
          </div>
          {!hasAnyPhoneNumber && (
            <p className="text-[11px] text-gray-500">
              No phone number is on this account. If the phone section is hidden in Clerk,
              verified email access still works.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Link
              href="/account"
              className="bg-[#00F2FE] text-black font-bold py-2.5 px-4 rounded-xl text-xs font-mono uppercase tracking-wider"
            >
              Open Account Verification
            </Link>
            <SignOutButton redirectUrl="/sign-in">
              <button
                type="button"
                className="bg-white/[0.04] border border-white/10 text-gray-300 font-bold py-2.5 px-4 rounded-xl text-xs font-mono uppercase tracking-wider"
              >
                Sign Out
              </button>
            </SignOutButton>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-[100dvh] w-screen bg-[#0d0e10] text-gray-200 overflow-hidden font-sans select-none relative">
      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[1px] lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col justify-between border-r border-white/[0.03] bg-[#111215] p-6 transition-transform duration-300 ease-in-out lg:static lg:z-20 lg:max-w-none lg:translate-x-0 ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="mb-10 flex items-center justify-between gap-2 px-2">
            <div
              onClick={() => handleTabSelect("dashboard")}
              className="flex cursor-pointer items-center gap-2"
            >
              <Zap className="text-[#00F2FE] h-5 w-5 stroke-[2.5] fill-none drop-shadow-[0_0_8px_rgba(0,242,254,0.5)]" />
              <div className="text-xl font-black italic tracking-tighter font-sans">
                <span className="text-white">APEX</span>
                <span className="text-[#00F2FE]">DRIVE</span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close navigation menu"
              className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white lg:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="space-y-1.5">
            {mainNavTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabSelect(tab.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-all text-sm min-h-[44px] ${
                  activeTab === tab.id
                    ? "bg-[#1c1e24] text-[#00F2FE] border border-[#00F2FE]/10 shadow-lg"
                    : "text-gray-400 hover:bg-white/[0.01]"
                }`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.locked && <Lock className="h-3 w-3 text-amber-400 shrink-0" />}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden z-10 relative">
        <header className="shrink-0 border-b border-white/[0.03] bg-[#111215]/40 backdrop-blur-md z-30 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 lg:h-20 lg:px-8 lg:py-0 lg:pt-0">
          <button
            type="button"
            onClick={() => handleTabSelect("dashboard")}
            className="mb-2 flex w-full items-center justify-center gap-2 lg:hidden"
          >
            <Zap className="text-[#00F2FE] h-5 w-5 stroke-[2.5] fill-none drop-shadow-[0_0_8px_rgba(0,242,254,0.5)]" />
            <span className="text-lg font-black italic tracking-tighter">
              <span className="text-white">APEX</span>
              <span className="text-[#00F2FE]">DRIVE</span>
            </span>
          </button>

          <div className="flex items-center gap-1.5 lg:h-20 lg:justify-between lg:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 lg:gap-3 lg:flex-none">
              <button
                type="button"
                aria-label="Open navigation menu"
                className="shrink-0 rounded-xl border border-white/[0.05] bg-[#16171b] p-2 text-gray-300 hover:text-white lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </button>
              <div ref={searchContainerRef} className="relative min-w-0 flex-1 lg:w-96 lg:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 h-3.5 w-3.5 lg:left-3 lg:h-4 lg:w-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                const value = event.target.value;
                setSearchQuery(value);
                setIsSearchResultsOpen(value.trim().length > 0);
              }}
              onFocus={() => {
                if (normalizedSearch) setIsSearchResultsOpen(true);
              }}
              placeholder="Search..."
              className="w-full bg-[#16171b] border border-white/[0.05] rounded-xl py-2 pl-8 pr-2 text-[11px] text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#00F2FE]/30 transition-all min-h-[40px] lg:min-h-[44px] lg:py-2.5 lg:pl-10 lg:pr-4 lg:text-xs"
            />
            {normalizedSearch && isSearchResultsOpen && (
              <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-[#111215] border border-white/10 rounded-xl shadow-2xl max-h-72 overflow-y-auto z-50">
                {searchResults.length === 0 ? (
                  <p className="text-xs text-gray-500 px-4 py-3">No results found for this query.</p>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSearchResultSelect(result)}
                      className="w-full px-4 py-3 text-left border-b border-white/[0.04] hover:bg-white/[0.02] transition-all"
                    >
                      <p className="text-xs text-white font-medium">{result.title}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{result.detail}</p>
                    </button>
                  ))
                )}
              </div>
            )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 lg:gap-4 relative shrink-0">
            <button
              ref={notificationButtonRef}
              onClick={() => setIsNotificationOpen((previous) => !previous)}
              className={`relative p-2 bg-[#16171b] border rounded-xl text-gray-400 hover:text-white transition-all min-h-[40px] min-w-[40px] lg:min-h-[44px] lg:min-w-[44px] lg:p-2.5 flex items-center justify-center ${
                isNotificationOpen ? "border-[#00F2FE]/30 text-white" : "border-white/[0.05]"
              }`}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 bg-[#00F2FE] rounded-full shadow-[0_0_8px_#00F2FE]"></span>
              )}
            </button>

            {isNotificationOpen && (
              <div
                ref={notificationPanelRef}
                className="absolute top-12 right-0 w-[min(360px,calc(100vw-2rem))] bg-[#111215] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <h3 className="text-xs font-mono uppercase tracking-wide text-white">Notifications</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-[10px] text-[#00F2FE] font-mono uppercase hover:underline"
                    >
                      Mark all read
                    </button>
                    <button
                      onClick={clearAllNotifications}
                      className="text-[10px] text-rose-300 font-mono uppercase hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-gray-500 px-4 py-3">No notifications yet.</p>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => markNotificationRead(notification.id)}
                        className={`w-full text-left px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-all ${
                          notification.unread ? "bg-[#00F2FE]/[0.03]" : ""
                        }`}
                      >
                        <p className="text-xs text-white leading-relaxed">{notification.text}</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-1">
                          {notification.type.toUpperCase()} • {formatTimeAgo(notification.createdAt)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className="h-8 w-8 lg:h-9 lg:w-9 rounded-full border border-white/10 overflow-hidden cursor-pointer bg-[#1a1b1f] flex items-center justify-center shrink-0"
            >
              {profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImageUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold text-[#00F2FE]">{profileInitials}</span>
              )}
            </button>
            <SignOutButton redirectUrl="/sign-in">
              <button
                type="button"
                className="hidden md:inline-flex bg-white/[0.04] border border-white/10 text-gray-300 font-bold py-2 px-3 rounded-xl text-[10px] font-mono uppercase tracking-wider hover:text-white transition-all min-h-[44px] items-center"
              >
                Sign Out
              </button>
            </SignOutButton>
          </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-8 relative">
          <div
            className={
              activeTab === "dashboard"
                ? "flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6 w-full lg:h-full animate-fadeIn"
                : "hidden"
            }
          >
            <div className="lg:col-span-2 bg-[#111215] border border-white/[0.03] rounded-2xl relative h-[min(52dvh,460px)] min-h-[320px] sm:h-[min(56dvh,500px)] sm:min-h-[420px] lg:min-h-[500px] lg:h-full overflow-hidden shadow-xl">
              {(isMapInteractionUnavailable || !isInteractiveMapReady) &&
                (!staticMapImageFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={staticMapImageUrl}
                  alt="Static map fallback"
                  className="absolute inset-0 w-full h-full rounded-2xl z-0 object-cover"
                  loading="lazy"
                  onLoad={() => setStaticMapImageFailed(false)}
                  onError={() => setStaticMapImageFailed(true)}
                />
              ) : (
                <>
                  <div className="absolute inset-0 w-full h-full rounded-2xl z-0 bg-gradient-to-br from-[#0d0e10] via-[#16171b] to-[#101923]" />
                  <iframe
                    title="OSM fallback map"
                    src={staticMapEmbedUrl}
                    className="absolute inset-0 w-full h-full rounded-2xl z-0 border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </>
              ))}
              <div
                ref={mapContainerRef}
                className={`absolute inset-0 w-full h-full rounded-2xl overflow-hidden bg-[#0d0e10] z-[1] transition-opacity duration-300 ${
                  isMapInteractionUnavailable ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
              />

              <div className="absolute inset-0 z-10 p-2 sm:p-4 md:p-6 pointer-events-none">
                <div className="flex h-full flex-col justify-between gap-2 sm:gap-3">
                  <div className="flex items-start justify-end">
                    <div
                      className={`shrink-0 bg-[#111215]/90 p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-md border border-white/10 shadow-xl pointer-events-auto transition-all duration-200 ${
                        isSectorPanelCollapsed
                          ? "w-[min(42vw,148px)] max-lg:max-h-none"
                          : "w-[min(88vw,280px)] max-lg:max-h-[55vh] max-lg:overflow-y-auto"
                      } sm:w-[264px] sm:max-w-[264px] lg:w-[264px] lg:max-h-none lg:overflow-visible`}
                    >
                      <button
                        type="button"
                        onClick={() => setIsSectorPanelCollapsed((previous) => !previous)}
                        className="flex w-full items-center justify-between gap-1 lg:hidden"
                        aria-expanded={!isSectorPanelCollapsed}
                      >
                        <p className="text-[8px] font-mono text-[#00F2FE] font-bold uppercase tracking-wide">
                          Sector Information
                        </p>
                        {isSectorPanelCollapsed ? (
                          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronUp className="h-3 w-3 text-gray-400 shrink-0" />
                        )}
                      </button>
                      <p className="text-[8px] sm:text-[10px] font-mono text-[#00F2FE] font-bold uppercase tracking-wide hidden lg:block">
                        Sector Information
                      </p>
                      <h2 className="text-[10px] sm:text-sm font-bold tracking-wide text-white uppercase leading-snug mt-0.5 sm:mt-1 line-clamp-2">
                        {locationLabel}
                      </h2>
                      {locationSource === "gps" && (
                        <p className="text-[8px] sm:text-[10px] font-mono text-[#00F2FE] mt-0.5 font-bold">
                          LIVE GPS LOCK
                        </p>
                      )}

                      {isSectorPanelCollapsed && (
                        <div className="mt-1.5 pt-1.5 border-t border-white/10 lg:hidden">
                          <div
                            className={`text-[8px] font-mono font-bold uppercase flex items-center gap-1 ${asphaltIndicatorClasses.text}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${asphaltIndicatorClasses.dot}`}
                            ></span>
                            <span className="truncate">{weatherCondition}</span>
                          </div>
                        </div>
                      )}

                      <div className={isSectorPanelCollapsed ? "hidden lg:block" : "block"}>
                      <p className="text-[8px] sm:text-[9px] font-mono text-gray-500 mt-0.5 sm:mt-1">{locationTelemetry}</p>
                      {isUsingFallbackMap && (
                        <p className="text-[8px] sm:text-[9px] font-mono text-amber-400 mt-0.5 sm:mt-1">
                          Fallback map tiles active
                        </p>
                      )}
                      {staticMapImageFailed && (
                        <p className="text-[8px] sm:text-[9px] font-mono text-amber-300 mt-0.5 sm:mt-1">
                          Static fallback image unavailable.
                        </p>
                      )}
                      {mapRuntimeIssue && (
                        <p className="text-[8px] sm:text-[9px] font-mono text-amber-300 mt-0.5 sm:mt-1 leading-relaxed">
                          {mapRuntimeIssue}
                        </p>
                      )}

                      <div className="mt-1.5 sm:mt-3 pt-1.5 sm:pt-2 border-t border-white/10">
                        <div
                          className={`text-[10px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5 ${asphaltIndicatorClasses.text}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${asphaltIndicatorClasses.dot}`}
                          ></span>
                          Asphalt Status
                        </div>
                        <p
                          className={`text-[11px] font-bold uppercase tracking-wide ${asphaltIndicatorClasses.text}`}
                        >
                          {weatherCondition}
                        </p>
                      </div>

                      {canUseHudAlerts && (
                        <div
                          className={`mt-1.5 sm:mt-3 pt-1.5 sm:pt-2 border-t border-white/10 ${
                            isTetherBroken ? "animate-pulse" : ""
                          }`}
                        >
                          <p className="text-[10px] font-mono text-gray-500 uppercase mb-1 flex items-center gap-1.5">
                            <Radio className="h-3 w-3" /> Tactical HUD
                          </p>
                          <p
                            className={`text-[11px] font-bold uppercase tracking-wide font-mono ${
                              isTetherBroken
                                ? "text-yellow-300 shadow-[0_0_10px_rgba(253,224,71,0.45)]"
                                : "text-emerald-400"
                            }`}
                          >
                            {activeRadarText}
                          </p>
                        </div>
                      )}

                      {canUseMeshNetwork && (
                        <div className="mt-1.5 sm:mt-3 pt-1.5 sm:pt-2 border-t border-white/10">
                          <p className="text-[10px] font-mono text-gray-500 uppercase mb-1 flex items-center gap-1.5">
                            <Wifi className="h-3 w-3" /> Mesh Relay
                          </p>
                          <p className="text-[10px] font-mono text-[#00F2FE]">
                            {meshNetworkState.relayActive
                              ? `Mesh hop active • ${meshNetworkState.peerNodeCount} peers • ${meshNetworkState.preservedPinCount} pins cached`
                              : "Cellular uplink online"}
                          </p>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end justify-start">
                    <div
                      className={`bg-[#16171b]/95 border border-white/[0.08] rounded-lg sm:rounded-xl p-2 sm:p-3 backdrop-blur-md pointer-events-auto shrink-0 transition-all duration-200 ${
                        isRoutePanelCollapsed
                          ? "w-[min(48vw,160px)] max-lg:max-h-none"
                          : "w-[min(88vw,300px)] max-lg:max-h-[55vh] max-lg:overflow-y-auto"
                      } sm:w-[285px] sm:max-w-[285px] lg:max-h-[70vh] ${
                        isRoutePanelCollapsed ? "sm:w-[225px]" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setIsRoutePanelCollapsed((previous) => !previous)}
                        className="flex w-full items-center justify-between gap-1 sm:gap-2 lg:hidden"
                        aria-expanded={!isRoutePanelCollapsed}
                      >
                        <p className="text-[8px] font-mono text-[#00F2FE] font-bold uppercase flex items-center gap-1">
                          <Route className="h-2.5 w-2.5" /> Route Trace
                        </p>
                        {isRoutePanelCollapsed ? (
                          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronUp className="h-3 w-3 text-gray-400 shrink-0" />
                        )}
                      </button>
                      <div className="hidden lg:flex items-center justify-between gap-2">
                        <p className="text-[10px] font-mono text-[#00F2FE] font-bold uppercase flex items-center gap-1.5">
                          <Route className="h-3 w-3" /> Route Trace
                        </p>
                        <div className="flex items-center gap-2">
                          {isTracingRoute && (
                            <span className="text-[9px] font-mono text-gray-500 uppercase">Calculating...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsRoutePanelCollapsed((previous) => !previous)}
                            className="text-[10px] font-mono uppercase text-gray-300 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 hover:text-white"
                          >
                            {isRoutePanelCollapsed ? (
                              <span className="inline-flex items-center gap-1">
                                <ChevronUp className="h-3 w-3" /> Expand
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <ChevronDown className="h-3 w-3" /> Collapse
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {isRoutePanelCollapsed && (
                        <div className="mt-1.5 space-y-1 lg:hidden">
                          <p className="text-[9px] font-mono text-gray-400 truncate">
                            {selectedRoutePreset?.name ?? "No route selected"}
                          </p>
                          {activeRoute && (
                            <p className="text-[9px] font-mono text-[#00F2FE]">
                              {formatRouteDistance(activeRoute.distanceMiles)} • {formatRouteDuration(activeRoute.durationMinutes)}
                            </p>
                          )}
                        </div>
                      )}

                      <div className={isRoutePanelCollapsed ? "hidden lg:block" : "block"}>
                        {isRoutePanelCollapsed ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-[10px] font-mono text-gray-400">
                            {selectedRoutePreset?.name ?? "No route selected"}
                          </p>
                          <p
                            className={`text-[10px] font-mono ${
                              hasArrivedAtSelectedRouteStart ? "text-emerald-400" : "text-gray-500"
                            }`}
                          >
                            {selectedRouteStartStatusText}
                          </p>
                          {activeRoute ? (
                            <p className="text-[10px] font-mono text-[#00F2FE]">
                              {formatRouteDistance(activeRoute.distanceMiles)} • {formatRouteDuration(activeRoute.durationMinutes)}
                            </p>
                          ) : (
                            <p className="text-[10px] text-gray-500">No active route loaded.</p>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={toggleFollowMe}
                              className={`py-1.5 px-2 rounded-lg text-[10px] font-mono uppercase font-bold border ${
                                isFollowMeEnabled
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                  : "bg-white/[0.04] border-white/10 text-gray-300"
                              }`}
                            >
                              Follow {isFollowMeEnabled ? "On" : "Off"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                isRouteNavigationActive
                                  ? stopRouteNavigation("Route navigation stopped.", true)
                                  : startRouteNavigation()
                              }
                              disabled={(!activeRoute && !isRouteNavigationActive) || isMapInteractionUnavailable}
                              className={`py-1.5 px-2.5 rounded-lg text-[10px] font-mono uppercase font-bold disabled:opacity-40 ${
                                isRouteNavigationActive
                                  ? "bg-white/[0.04] border border-white/10 text-gray-300"
                                  : "bg-[#00F2FE] text-black"
                              }`}
                            >
                              {isRouteNavigationActive ? "Stop" : "Start"}
                            </button>
                          </div>
                        </div>
                        ) : (
                        <>
                          <p className="text-[10px] font-mono text-gray-400 mt-2">
                            Route start: {selectedRoutePreset?.start.label ?? "--"}
                          </p>
                          <p
                            className={`text-[10px] font-mono ${
                              hasArrivedAtSelectedRouteStart ? "text-emerald-400" : "text-gray-500"
                            }`}
                          >
                            {selectedRouteStartStatusText}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={toggleFollowMe}
                              className={`px-2 py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold border ${
                                isFollowMeEnabled
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                  : "bg-white/[0.04] border-white/10 text-gray-300"
                              }`}
                            >
                              Follow {isFollowMeEnabled ? "On" : "Off"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                isRouteNavigationActive
                                  ? stopRouteNavigation("Route navigation stopped.", true)
                                  : startRouteNavigation()
                              }
                              disabled={(!activeRoute && !isRouteNavigationActive) || isMapInteractionUnavailable}
                              className={`py-1.5 px-2.5 rounded-lg text-[10px] font-mono uppercase font-bold disabled:opacity-40 ${
                                isRouteNavigationActive
                                  ? "bg-white/[0.04] border border-white/10 text-gray-300"
                                  : "bg-[#00F2FE] text-black"
                              }`}
                            >
                              {isRouteNavigationActive ? "Stop Route" : "Start Route"}
                            </button>
                          </div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                const next = !routePinModeRef.current;
                                routePinModeRef.current = next;
                                setIsRoutePinMode(next);
                              }}
                              disabled={isMapInteractionUnavailable}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold transition-all ${
                                isRoutePinMode
                                  ? "bg-[#00F2FE] text-black"
                                  : "bg-white/[0.04] border border-white/10 text-gray-300"
                              } disabled:opacity-40`}
                            >
                              {isRoutePinMode ? "Cancel Pin" : "Drop Pin"}
                            </button>
                            <button
                              type="button"
                              onClick={traceRouteToPinnedPoint}
                              disabled={!pendingRoutePin || isMapInteractionUnavailable}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold bg-[#00F2FE] text-black disabled:opacity-40"
                            >
                              Trace To Pin
                            </button>
                            {pendingRoutePin && (
                              <button
                                type="button"
                                onClick={clearRoutePin}
                                className="px-2 py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold bg-white/[0.04] border border-white/10 text-gray-300"
                              >
                                Clear Pin
                              </button>
                            )}
                            {activeRoute && (
                              <button
                                type="button"
                                onClick={clearRouteAndNavigation}
                                className="px-2 py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold bg-white/[0.04] border border-white/10 text-gray-300"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          {activeRoute ? (
                            <div className="mt-2 space-y-1.5">
                              <p className="text-[10px] font-semibold text-white">{activeRoute.name}</p>
                              <p className="text-[10px] font-mono text-[#00F2FE]">
                                {formatRouteDistance(activeRoute.distanceMiles)} • {formatRouteDuration(activeRoute.durationMinutes)}
                              </p>
                              {isRouteNavigationActive && (
                                <p className="text-[9px] font-mono text-emerald-400">
                                  {isNavigationRerouting
                                    ? "Rerouting..."
                                    : navigationRemainingDistance != null
                                      ? `Following GPS • ${formatRouteDistance(navigationRemainingDistance)} left`
                                      : "Following GPS"}
                                </p>
                              )}
                              {activeRoute.steps.length > 0 && (
                                <p className="text-[9px] text-gray-400 leading-relaxed">
                                  1. {activeRoute.steps[0]}
                                </p>
                              )}
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Save as"
                                  value={favoriteRouteName}
                                  onChange={(event) => setFavoriteRouteName(event.target.value)}
                                  className="flex-1 min-w-0 bg-[#111215] border border-white/10 rounded-lg py-1.5 px-2 text-[10px] text-white focus:border-[#00F2FE]/40 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={saveActiveRouteToFavorites}
                                  className="bg-[#00F2FE] text-black font-bold py-1.5 px-2.5 rounded-lg text-[10px] font-mono uppercase"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-gray-500 mt-2">
                              Trace a route to start navigation guidance.
                            </p>
                          )}
                        </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="bg-[#111215] border border-white/[0.03] rounded-2xl p-3 shadow-xl max-h-[172px] flex flex-col">
                <div className="text-[10px] font-mono text-gray-400 font-bold uppercase mb-2 flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-1.5">
                    Active Reports
                    {mapReports.length > 0 && (
                      <span className="h-1.5 w-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444] animate-pulse"></span>
                    )}
                  </span>
                  <span className="text-gray-600">{mapReports.length}</span>
                </div>
                {mapReports.length === 0 ? (
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    {mapRuntimeIssue
                      ? "Interactive map unavailable right now."
                      : "No active reports nearby. Tap the map to flag a cop alert or road hazard."}
                  </p>
                ) : (
                  <div className="space-y-1.5 overflow-y-auto pr-1">
                    {mapReports.map((report) => (
                      <div
                        key={report.id}
                        className={`w-full text-left rounded-lg border px-2.5 py-2 transition-all ${
                          report.type === "radar"
                            ? "bg-red-500/10 border-red-500/20"
                            : "bg-amber-500/10 border-amber-500/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              mapRef.current?.flyTo({
                                center: [report.lng, report.lat],
                                zoom: 14,
                                essential: true,
                              })
                            }
                            className={`flex-1 text-left hover:opacity-90 ${report.type === "radar" ? "text-red-400" : "text-amber-400"}`}
                          >
                            <p className="text-[10px] font-bold uppercase">
                              {report.type === "radar" ? "🚨" : "⚠️"} {report.label}
                            </p>
                            <p className="text-[9px] font-mono text-gray-500 mt-1">
                              {formatTimeAgo(report.createdAt)}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMapReport(report.id)}
                            className="text-gray-600 hover:text-white shrink-0"
                            aria-label="Dismiss report"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#111215] border border-white/[0.03] rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <p className="text-[10px] font-mono text-gray-400 font-bold uppercase">
                    Post-Drive Route Replay
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-gray-600">
                      {routeTrackingHistory.length} GPS{" "}
                      {routeTrackingHistory.length === 1 ? "point" : "points"}
                    </span>
                    {routeTrackingHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearRouteReplay}
                        className="text-[9px] font-mono uppercase text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-lg px-2 py-1"
                      >
                        Clear Replay
                      </button>
                    )}
                  </div>
                </div>
                {routeTrackingHistory.length < 2 ? (
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    {routeTrackingHistory.length === 0
                      ? "Replay is available on all tiers. GPS history builds automatically while you drive with a live GPS lock."
                      : "1 GPS point recorded so far — keep moving (or start route navigation) to capture a second point and unlock the replay slider."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[9px] font-mono text-gray-500 uppercase">
                        <span>
                          {replayStartTimestamp
                            ? formatReplayClock(replayStartTimestamp)
                            : "Start"}
                        </span>
                        <span className="text-amber-300">
                          {replayPoint ? formatReplayClock(replayPoint.timestamp) : "--"}
                        </span>
                        <span>
                          {replayEndTimestamp ? formatReplayClock(replayEndTimestamp) : "End"}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(routeTrackingHistory.length - 1, 0)}
                        value={replayIndex}
                        onChange={(event) =>
                          handleReplayIndexChange(Number.parseInt(event.target.value, 10))
                        }
                        onPointerDown={() => setIsReplayScrubbing(true)}
                        onPointerUp={() => setIsReplayScrubbing(false)}
                        onPointerCancel={() => setIsReplayScrubbing(false)}
                        onTouchEnd={() => setIsReplayScrubbing(false)}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-[#16171b] accent-[#fbbf24]"
                        aria-label="Scrub post-drive route replay"
                      />
                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                        <span>
                          Moment {replayIndex + 1}/{routeTrackingHistory.length}
                        </span>
                        <span>{replayProgressPercent}% through drive</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      {isViewingPastReplay
                        ? "Scrubbing replay — only the driven path up to this moment is shown on the map."
                        : "Live edge — replay is synced to your latest GPS point."}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="bg-[#16171b] border border-white/[0.04] rounded-lg px-2 py-1.5">
                        <span className="text-gray-500 block text-[8px] uppercase">Distance</span>
                        <span className="text-white">
                          {formatRouteDistance(replayStatistics.totalMiles)}
                        </span>
                      </div>
                      <div className="bg-[#16171b] border border-white/[0.04] rounded-lg px-2 py-1.5">
                        <span className="text-gray-500 block text-[8px] uppercase">Duration</span>
                        <span className="text-white">{replayStatistics.durationMinutes} min</span>
                      </div>
                      <div className="bg-[#16171b] border border-white/[0.04] rounded-lg px-2 py-1.5">
                        <span className="text-gray-500 block text-[8px] uppercase">Max Speed</span>
                        <span className="text-white">{replayStatistics.maxSpeedMph} mph</span>
                      </div>
                      <div className="bg-[#16171b] border border-white/[0.04] rounded-lg px-2 py-1.5">
                        <span className="text-gray-500 block text-[8px] uppercase">Tether Breaks</span>
                        <span className="text-white">{replayStatistics.tetherBreakCount}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportDriveStatistics}
                      className="w-full bg-white/[0.04] border border-white/10 text-gray-200 font-mono py-2 rounded-xl text-[10px] uppercase tracking-wider hover:border-[#00F2FE]/30 hover:text-white transition-all"
                    >
                      Export Statistics
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-[#111215] border border-white/[0.03] rounded-2xl p-5 flex flex-col justify-between lg:min-h-[500px] shadow-xl">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white border-l-2 border-[#00F2FE] pl-2 font-mono">
                      Stealth Convoys
                    </h3>
                    <button
                      onClick={() => setActiveTab("convoys")}
                      className="text-[10px] font-mono text-[#00F2FE] uppercase font-bold hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {filteredConvoys.length === 0 ? (
                      <div className="bg-[#16171b] border border-white/[0.04] rounded-xl p-4 text-[11px] text-gray-500 leading-relaxed">
                        {convoys.length === 0
                          ? "No active convoys yet. Create your first convoy to populate this dashboard."
                          : "No convoys match your current search filter."}
                      </div>
                    ) : (
                      filteredConvoys.slice(0, 2).map((convoy) => (
                        <div key={convoy.id} className="bg-[#16171b] border border-white/[0.04] rounded-xl p-4 shadow-md">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-xs text-white tracking-wide">{convoy.title}</h4>
                              <p className="text-[9px] font-mono text-gray-500 mt-0.5 flex items-center gap-1.5">
                                <Lock className="h-3 w-3" /> {formatDeparture(convoy.departureAt)} • {convoy.route}
                              </p>
                            </div>
                            <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded border ${getStatusStyle(convoy.status)}`}>
                              {convoy.status}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-white/[0.02]">
                            <div className="text-[9px] font-mono">
                              <span className="text-gray-500 block text-[7px] tracking-wider">STARTS IN</span>
                              <span className="text-orange-400 font-bold">{formatCountdown(convoy.departureAt)}</span>
                            </div>
                            <span className="text-[9px] font-mono bg-white/[0.01] border border-white/[0.05] text-gray-300 px-2 py-0.5 rounded flex items-center gap-1">
                              <Users className="h-2.5 w-2.5 text-[#00F2FE]" /> {convoy.members}/{convoy.capacity}
                            </span>
                          </div>
                          <p className="text-[9px] font-mono text-gray-500 mt-2 uppercase">
                            {convoy.joinMode === "passcode" ? "Passcode Join" : "Invite Only"}
                          </p>
                          {renderConvoyAction(convoy, true)}
                        </div>
                      ))
                    )}
                  </div>

                  {showDisplayAds && (
                    <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-gradient-to-r from-[#16171b] to-[#111215] p-4">
                      <p className="text-[9px] font-mono uppercase text-gray-500 mb-1">Sponsored</p>
                      <p className="text-xs text-white font-semibold">Upgrade to Apex Interceptor</p>
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                        Remove ads, unlock tactical HUD alerts, audio pace notes, and expand your garage to 5 vehicles.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab("settings")}
                        className="mt-3 text-[10px] font-mono uppercase text-[#00F2FE] font-bold hover:underline"
                      >
                        View Plans
                      </button>
                    </div>
                  )}

                  <div className="mt-5 pt-4 border-t border-white/[0.05]">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-white border-l-2 border-[#00F2FE] pl-2 font-mono">
                        Upcoming Meets
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab("clubs")}
                        className="text-[10px] font-mono text-[#00F2FE] uppercase font-bold hover:underline"
                      >
                        Open Clubs
                      </button>
                    </div>

                    {upcomingMeetsForDashboard.length === 0 ? (
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        No upcoming meets right now. Head to Clubs & Meets to publish one.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {upcomingMeetsForDashboard.map((meet) => (
                          <div
                            key={meet.id}
                            className="bg-[#16171b] border border-white/[0.04] rounded-xl px-3 py-2.5"
                          >
                            <p className="text-[11px] text-white font-semibold">{meet.title}</p>
                            <p className="text-[10px] font-mono text-gray-500 mt-1">
                              {meet.location} • {new Date(meet.date).toLocaleString()}
                            </p>
                            <p className="text-[10px] font-mono text-[#00F2FE] mt-1">
                              Host: {meet.host}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("convoys")}
                  className="w-full border border-dashed border-white/10 hover:border-[#00F2FE]/30 hover:bg-[#00F2FE]/5 rounded-xl py-3 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-white transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-[9px] font-mono uppercase tracking-widest font-bold">
                    Create / Join Convoy
                  </span>
                </button>
              </div>
            </div>
          </div>

          {activeTab === "maps" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/5 pb-4">
                <h2 className="text-xl font-bold tracking-wide text-white font-sans uppercase">Interactive Maps</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Build and load favorite routes with full start-to-finish guidance.
                </p>
              </div>

              <div className="bg-[#111215] border border-white/5 rounded-2xl p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-white font-semibold">Current Route Focus</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {selectedRoutePreset?.name ?? "No route selected"}
                  </p>
                  <p className="text-[10px] font-mono text-gray-500 mt-1">
                    {selectedRoutePreset
                      ? `${selectedRoutePreset.start.label} → ${selectedRoutePreset.end.label}`
                      : "Select a route card below to load route focus details."}
                  </p>
                  <p
                    className={`text-[10px] font-mono mt-1 ${
                      hasArrivedAtSelectedRouteStart ? "text-emerald-400" : "text-gray-500"
                    }`}
                  >
                    {selectedRoutePreset == null
                      ? "No active route selected."
                      : hasArrivedAtSelectedRouteStart
                        ? "At route start. Route focus can be started."
                        : selectedRouteStartStatusText}
                  </p>
                  {isRouteNavigationActive && (
                    <p className="text-[10px] font-mono text-emerald-400 mt-1">
                      {isNavigationRerouting
                        ? "Rerouting live..."
                        : navigationRemainingDistance != null
                          ? `Navigation active • ${formatRouteDistance(navigationRemainingDistance)} remaining`
                          : "Navigation active"}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      isRouteNavigationActive
                        ? stopRouteNavigation("Route navigation stopped.", true)
                        : startRouteNavigation()
                    }
                    disabled={(!activeRoute && !isRouteNavigationActive) || isMapInteractionUnavailable}
                    className={`font-bold py-2.5 px-4 rounded-xl text-xs font-mono uppercase tracking-wide disabled:opacity-40 min-h-[44px] ${
                      isRouteNavigationActive
                        ? "bg-white/[0.04] border border-white/10 text-gray-300"
                        : "bg-[#00F2FE] text-black"
                    }`}
                  >
                    {isRouteNavigationActive ? "Stop Route" : "Start Route"}
                  </button>
                  <button
                    onClick={centerMapOnUser}
                    disabled={isMapInteractionUnavailable}
                    className="bg-[#00F2FE] text-black font-bold py-2 px-4 rounded-xl text-xs font-mono uppercase tracking-wide disabled:opacity-40"
                  >
                    Re-center on my location
                  </button>
                  <button
                    type="button"
                    onClick={toggleFollowMe}
                    className={`font-bold py-2 px-3 rounded-xl text-xs font-mono uppercase tracking-wide border ${
                      isFollowMeEnabled
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-white/[0.04] border-white/10 text-gray-300"
                    }`}
                  >
                    Follow Me {isFollowMeEnabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    onClick={clearRouteAndNavigation}
                    className="bg-white/[0.04] border border-white/10 text-gray-300 font-bold py-2 px-3 rounded-xl text-xs font-mono uppercase tracking-wide"
                  >
                    Clear route
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                {filteredRoutes.map((route, index) => {
                  const distanceToStart = userLocation
                    ? distanceMilesBetween(userLocation, {
                        lat: route.start.lat,
                        lng: route.start.lng,
                      })
                    : null;
                  const isAtRouteStart =
                    distanceToStart != null &&
                    distanceToStart <= ROUTE_START_READY_RADIUS_MILES;

                  return (
                    <div
                      key={route.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRouteId(route.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedRouteId(route.id);
                        }
                      }}
                      className={`bg-[#111215] border rounded-2xl p-5 transition-all shadow-xl cursor-pointer ${
                        selectedRouteId === route.id
                          ? "border-[#00F2FE]/40"
                          : "border-white/5 hover:border-[#00F2FE]/25"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[9px] font-mono font-bold bg-[#00F2FE]/10 text-[#00F2FE] px-2.5 py-0.5 rounded-full border border-[#00F2FE]/20 uppercase">
                          Sector {index + 1}
                        </span>
                        <Sliders className="h-4 w-4 text-gray-500" />
                      </div>
                      <h4 className="font-bold text-white text-sm mb-1">{route.name}</h4>
                      <p className="text-[10px] font-mono text-gray-400 leading-relaxed">
                        {route.description}
                      </p>
                      <p className="text-[10px] font-mono text-gray-500 mt-2">
                        Start: {route.start.label}
                      </p>
                      <p className="text-[10px] font-mono text-gray-500">
                        End: {route.end.label}
                      </p>
                      <p
                        className={`text-[10px] font-mono mt-1 ${
                          isAtRouteStart ? "text-emerald-400" : "text-[#00F2FE]"
                        }`}
                      >
                        {distanceToStart == null
                          ? "Waiting for GPS lock..."
                          : isAtRouteStart
                            ? "At route start. Ready to launch route focus."
                            : `${formatRouteDistance(distanceToStart)} to route start`}
                      </p>
                      <div className="mt-4 space-y-2">
                        <button
                          type="button"
                          onClick={() => guideToRouteStart(route)}
                          disabled={isMapInteractionUnavailable}
                          className="w-full bg-[#1c1e24] border border-white/5 text-gray-300 font-mono py-2 rounded-xl text-[10px] tracking-wider uppercase transition-all hover:text-white hover:border-[#00F2FE]/20 disabled:opacity-40"
                        >
                          Get Me There
                        </button>
                        <button
                          type="button"
                          onClick={() => startPresetRouteFocus(route)}
                          disabled={!isAtRouteStart || isMapInteractionUnavailable}
                          className="w-full bg-[#00F2FE] text-black font-bold font-mono py-2 rounded-xl text-[10px] tracking-wider uppercase disabled:opacity-40"
                        >
                          Start Route Focus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-[#111215] border border-white/5 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase">Submit Community Route</h3>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Drivers can submit custom routes here for approval before they are published.
                    </p>
                  </div>
                  <p className="text-[10px] font-mono text-amber-300 uppercase tracking-wide">
                    {pendingRouteSubmissionCount} pending
                  </p>
                </div>

                <form onSubmit={handleSubmitRouteProposal} className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                      Route Name
                    </label>
                    <input
                      type="text"
                      value={routeSubmissionForm.name}
                      onChange={(event) =>
                        setRouteSubmissionForm((previous) => ({ ...previous, name: event.target.value }))
                      }
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2 px-3 text-[11px] text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      placeholder="Sunset Ridge Sprint"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                      Start Point
                    </label>
                    <input
                      type="text"
                      value={routeSubmissionForm.startLabel}
                      onChange={(event) =>
                        setRouteSubmissionForm((previous) => ({
                          ...previous,
                          startLabel: event.target.value,
                        }))
                      }
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2 px-3 text-[11px] text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      placeholder="Downtown Bellevue"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                      End Point
                    </label>
                    <input
                      type="text"
                      value={routeSubmissionForm.endLabel}
                      onChange={(event) =>
                        setRouteSubmissionForm((previous) => ({
                          ...previous,
                          endLabel: event.target.value,
                        }))
                      }
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2 px-3 text-[11px] text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      placeholder="North Bend Overlook"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                      Notes for Review
                    </label>
                    <textarea
                      value={routeSubmissionForm.notes}
                      onChange={(event) =>
                        setRouteSubmissionForm((previous) => ({ ...previous, notes: event.target.value }))
                      }
                      rows={2}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2 px-3 text-[11px] text-white focus:border-[#00F2FE]/40 focus:outline-none resize-none"
                      placeholder="Share why this route is safe, scenic, and worth approving."
                    />
                  </div>
                  <button
                    type="submit"
                    className="col-span-2 bg-[#00F2FE] text-black font-bold py-2.5 rounded-xl text-[10px] font-mono uppercase tracking-wide hover:opacity-90 transition-all"
                  >
                    Submit Route For Approval
                  </button>
                </form>

                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Submitted Routes
                  </p>
                  {ownRouteSubmissions.length === 0 ? (
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      No route submissions yet. Use the form above to submit the first community route.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {ownRouteSubmissions.map((submission) => (
                        <div
                          key={submission.id}
                          className="bg-[#16171b] border border-white/[0.04] rounded-xl p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[11px] text-white font-semibold">{submission.name}</p>
                              <p className="text-[10px] font-mono text-gray-500 mt-1">
                                {submission.startLabel} → {submission.endLabel}
                              </p>
                              {submission.notes && (
                                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                                  {submission.notes}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-[9px] font-mono uppercase ${
                                  submission.status === "approved"
                                    ? "text-emerald-400"
                                    : submission.status === "rejected"
                                      ? "text-rose-400"
                                      : "text-amber-300"
                                }`}
                              >
                                {submission.status}
                              </p>
                              <p className="text-[9px] font-mono text-gray-600 mt-1">
                                {formatTimeAgo(submission.submittedAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#111215] border border-white/5 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase">Approved Routes Feed</h3>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Community-approved routes ready for everyone to reference and run.
                    </p>
                  </div>
                  <p className="text-[10px] font-mono text-emerald-300 uppercase tracking-wide">
                    {approvedRouteSubmissions.length} approved
                  </p>
                </div>

                {approvedRouteSubmissions.length === 0 ? (
                  <p className="text-[11px] text-gray-500 leading-relaxed mt-4">
                    No approved community routes yet. Admins can approve pending submissions in
                    Settings.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 mt-4">
                    {approvedRouteSubmissions.map((submission) => (
                      <div
                        key={`approved-${submission.id}`}
                        className="bg-[#16171b] border border-white/[0.04] rounded-xl p-3"
                      >
                        <p className="text-[11px] text-white font-semibold">{submission.name}</p>
                        <p className="text-[10px] font-mono text-gray-500 mt-1">
                          {submission.startLabel} → {submission.endLabel}
                        </p>
                        {submission.notes && (
                          <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                            {submission.notes}
                          </p>
                        )}
                        <p className="text-[9px] font-mono text-emerald-400 mt-1 uppercase">
                          Approved • {formatTimeAgo(submission.submittedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#111215] border border-white/5 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase">Friend Location Intel</h3>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Live friend markers show on the dashboard map with route or meet activity.
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#00F2FE]/10 border border-[#00F2FE]/20 text-[9px] font-mono uppercase text-[#00F2FE]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00F2FE]"></span>
                        Route Activity
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-mono uppercase text-amber-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                        Meet Activity
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFriendLayerVisible((previous) => !previous)}
                    className={`text-[10px] font-mono uppercase font-bold px-2.5 py-1.5 rounded-lg border ${
                      isFriendLayerVisible
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-white/[0.04] border-white/10 text-gray-300"
                    }`}
                  >
                    Friend Pins {isFriendLayerVisible ? "On" : "Off"}
                  </button>
                </div>

                {friendMapPresence.length === 0 ? (
                  <p className="text-[11px] text-gray-500 leading-relaxed mt-4">
                    Add friends in the Friends tab to unlock live location intel.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 mt-4">
                    {friendMapPresence.map((presence) => (
                      <div
                        key={`friend-presence-${presence.friendId}`}
                        className="bg-[#16171b] border border-white/[0.04] rounded-xl p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] text-white font-semibold">{presence.handle}</p>
                            <p className="text-[10px] font-mono text-gray-500 mt-1">
                              {presence.lat.toFixed(4)}, {presence.lng.toFixed(4)}
                            </p>
                            <p
                              className={`text-[10px] mt-1 ${
                                presence.activityType === "meet"
                                  ? "text-amber-300"
                                  : "text-[#00F2FE]"
                              }`}
                            >
                              {presence.activityLabel}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => focusFriendPresenceOnMap(presence)}
                            className="bg-white/[0.04] border border-white/10 text-gray-300 font-bold py-1.5 px-2.5 rounded-lg text-[10px] font-mono uppercase hover:text-white"
                          >
                            Focus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div className="bg-[#111215] border border-white/5 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white uppercase mb-4">Favorite Routes</h3>
                  {favoriteRoutes.length === 0 ? (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Trace a route from a map pin, then save it. Saved favorites appear here for instant start-to-finish routing.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {favoriteRoutes.map((route) => (
                        <div key={route.id} className="bg-[#16171b] border border-white/[0.04] rounded-xl p-3">
                          <p className="text-xs font-semibold text-white">{route.name}</p>
                          <p className="text-[10px] font-mono text-gray-500 mt-1">
                            {route.start.label} → {route.end.label}
                          </p>
                          <p className="text-[10px] font-mono text-[#00F2FE] mt-1">
                            {formatRouteDistance(route.distanceMiles)} • {formatRouteDuration(route.durationMinutes)}
                          </p>
                          <div className="flex gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => loadFavoriteRoute(route)}
                              className="flex-1 bg-[#00F2FE] text-black font-bold py-1.5 rounded-lg text-[10px] font-mono uppercase"
                            >
                              Load Route
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFavoriteRoute(route.id)}
                              className="bg-white/[0.04] border border-white/10 text-gray-300 font-bold py-1.5 px-2 rounded-lg text-[10px] font-mono uppercase"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[#111215] border border-white/5 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white uppercase mb-4">How To Get There</h3>
                  {activeRoute ? (
                    <div className="space-y-3">
                      <div className="bg-[#16171b] border border-white/[0.04] rounded-xl p-3">
                        <p className="text-xs text-white font-semibold">{activeRoute.name}</p>
                        <p className="text-[10px] font-mono text-gray-500 mt-1">
                          {activeRoute.start.label} → {activeRoute.end.label}
                        </p>
                        <p className="text-[10px] font-mono text-[#00F2FE] mt-1">
                          ETA {formatRouteDuration(activeRoute.durationMinutes)} • {formatRouteDistance(activeRoute.distanceMiles)}
                        </p>
                      </div>
                      <div className="bg-[#16171b] border border-white/[0.04] rounded-xl p-3 space-y-2">
                        {activeRoute.steps.length > 0 ? (
                          activeRoute.steps.map((step, index) => (
                            <p key={`${activeRoute.id}-instruction-${index}`} className="text-[10px] text-gray-300 leading-relaxed">
                              {index + 1}. {step}
                            </p>
                          ))
                        ) : (
                          <p className="text-[10px] text-gray-500">
                            Turn-by-turn guidance unavailable for this route.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Load a route to view ETA, distance, and turn instructions.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "convoys" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white uppercase">Private Group Drives & Events</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Manage exclusive private convoys, invitation-only group drives, and scheduled driving events.
                  </p>
                  <p className="text-[10px] font-mono text-[#00F2FE] mt-1 uppercase">
                    Tier: {tierLabel(effectiveUserTier)}
                    {isSiteAdmin ? " • Site Admin" : ""}
                  </p>
                </div>
                <button
                  ref={createConvoyButtonRef}
                  onClick={() => {
                    if (!canManagePrivateConvoys) {
                      openTierGateModal(
                        "Hosting private group drives and exclusive events requires Convoy Commander tier."
                      );
                      return;
                    }
                    setIsCreateConvoyOpen((previous) => !previous);
                  }}
                  className="text-xs font-mono bg-[#00F2FE] text-black font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {canManagePrivateConvoys ? (
                    <>
                      <Plus className="h-4 w-4" /> New Private Event
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Commander Required
                    </>
                  )}
                </button>
              </div>

              <div className="bg-[#111215] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#00F2FE]" />
                    <h3 className="text-sm font-bold text-white uppercase font-mono">Event Schedule Calendar</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setConvoyCalendarMonth(
                          (previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
                        )
                      }
                      className="text-[10px] font-mono uppercase text-gray-400 hover:text-white px-2 py-1 border border-white/10 rounded-lg"
                    >
                      Prev
                    </button>
                    <span className="text-xs font-mono text-white min-w-[120px] text-center">
                      {convoyCalendarMonth.toLocaleString(undefined, {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setConvoyCalendarMonth(
                          (previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
                        )
                      }
                      className="text-[10px] font-mono uppercase text-gray-400 hover:text-white px-2 py-1 border border-white/10 rounded-lg"
                    >
                      Next
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-1 px-1 pb-1">
                <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[280px] text-[9px] font-mono uppercase text-gray-500 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                    <div key={label} className="text-center">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[280px]">
                  {convoyCalendarDays.map((cell, index) => (
                    <div
                      key={`${cell.day ?? "empty"}-${index}`}
                      className={`min-h-[72px] rounded-xl border p-2 ${
                        cell.day
                          ? "border-white/[0.06] bg-[#16171b]"
                          : "border-transparent bg-transparent"
                      }`}
                    >
                      {cell.day != null && (
                        <>
                          <p className="text-[10px] font-mono text-gray-400">{cell.day}</p>
                          <div className="mt-1 space-y-1">
                            {cell.events.slice(0, 2).map((event) => (
                              <p
                                key={event.id}
                                className="text-[8px] font-mono text-[#00F2FE] truncate"
                                title={event.title}
                              >
                                {event.title}
                              </p>
                            ))}
                            {cell.events.length > 2 && (
                              <p className="text-[8px] font-mono text-gray-500">
                                +{cell.events.length - 2} more
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                </div>
              </div>

              {isCreateConvoyOpen && canManagePrivateConvoys && (
                <form
                  ref={createConvoyFormRef}
                  onSubmit={handleCreateConvoy}
                  className="bg-[#111215] border border-white/5 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                      Convoy Title
                    </label>
                    <input
                      type="text"
                      value={convoyForm.title}
                      onChange={(event) =>
                        setConvoyForm((previous) => ({ ...previous, title: event.target.value }))
                      }
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                      Route
                    </label>
                    <input
                      type="text"
                      value={convoyForm.route}
                      onChange={(event) =>
                        setConvoyForm((previous) => ({ ...previous, route: event.target.value }))
                      }
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                      Departure
                    </label>
                    <input
                      type="datetime-local"
                      value={convoyForm.departureAt}
                      onChange={(event) =>
                        setConvoyForm((previous) => ({ ...previous, departureAt: event.target.value }))
                      }
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                      Capacity
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={convoyForm.capacity}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        setConvoyForm((previous) => ({
                          ...previous,
                          capacity: Number.isNaN(parsed) ? 2 : parsed,
                        }));
                      }}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                      Access Mode
                    </label>
                    <select
                      value={convoyForm.joinMode}
                      onChange={(event) =>
                        setConvoyForm((previous) => ({
                          ...previous,
                          joinMode: event.target.value as ConvoyJoinMode,
                        }))
                      }
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                    >
                      <option value="invite">Invite Requests</option>
                      <option value="passcode">Passcode Entry</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                      Passcode (if required)
                    </label>
                    <input
                      type="text"
                      value={convoyForm.passcode}
                      onChange={(event) =>
                        setConvoyForm((previous) => ({ ...previous, passcode: event.target.value }))
                      }
                      disabled={convoyForm.joinMode !== "passcode"}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white disabled:opacity-40 focus:border-[#00F2FE]/40 focus:outline-none uppercase"
                    />
                  </div>
                  <button
                    type="submit"
                    className="col-span-2 bg-[#00F2FE] text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-90 transition-all font-mono uppercase tracking-wider"
                  >
                    Launch Private Convoy
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredConvoys.length === 0 ? (
                  <div className="col-span-2 bg-[#111215] border border-white/5 rounded-2xl p-6 text-sm text-gray-500">
                    {convoys.length === 0
                      ? "No convoys yet. Create a convoy above to start building your roster."
                      : "No convoys match your current search filter."}
                  </div>
                ) : (
                  filteredConvoys.map((convoy) => (
                    <div key={convoy.id} className="bg-[#111215] border border-white/5 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-sm text-white tracking-wide">{convoy.title}</h4>
                          <p className="text-xs text-[#00F2FE] font-mono mt-0.5">
                            {convoy.route} • Host: {convoy.host}
                          </p>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border ${getStatusStyle(convoy.status)}`}>
                          {convoy.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/[0.02] mt-4">
                        <div className="font-mono text-xs">
                          <span className="text-gray-500 block text-[8px] tracking-widest">DEPARTURE</span>
                          {formatDeparture(convoy.departureAt)}
                        </div>
                        <div className="font-mono text-xs text-right">
                          <span className="text-gray-500 block text-[8px] tracking-widest">TIME DEPLOYING</span>
                          <span className="text-orange-400 font-bold">{formatCountdown(convoy.departureAt)}</span>
                        </div>
                      </div>
                      <p className="text-[10px] font-mono text-gray-500 mt-3 uppercase">
                        Access: {convoy.joinMode === "invite" ? "Invitation Request" : "Passcode Join"} • Crew{" "}
                        {convoy.members}/{convoy.capacity}
                      </p>
                      {renderConvoyAction(convoy)}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "garage" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white uppercase">The Digital Garage</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Save full build profiles including photos, mods, and output stats.
                  </p>
                  <p className="text-[10px] font-mono text-[#00F2FE] mt-1 uppercase">
                    {garageLimit == null
                      ? `${vehicles.length} vehicles • Unlimited slots (Commander)`
                      : `${vehicles.length}/${garageLimit} slots • ${tierLabel(effectiveUserTier)}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (isGarageAtCapacity) {
                      openTierGateModal(
                        effectiveUserTier === "free"
                          ? "Free tier is capped at 2 vehicle slots. Upgrade to Apex Interceptor for 5 slots or Convoy Commander for unlimited garage capacity."
                          : "Interceptor tier is capped at 5 vehicle slots. Upgrade to Convoy Commander for unlimited garage capacity."
                      );
                      return;
                    }
                    setIsVehicleModalOpen(true);
                  }}
                  className="text-xs font-mono bg-[#00F2FE] text-black font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 hover:opacity-90 transition-all shadow-[0_0_15px_rgba(0,242,254,0.15)] disabled:opacity-50"
                  disabled={isGarageAtCapacity}
                >
                  {isGarageAtCapacity ? (
                    <>
                      <Lock className="h-4 w-4" /> Garage Full
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Add Vehicle
                    </>
                  )}
                </button>
              </div>

              {filteredVehicles.length === 0 ? (
                <div className="bg-[#111215] border border-white/5 rounded-2xl p-8 text-center text-gray-500 text-sm">
                  No vehicles found for this search.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                  {filteredVehicles.map((vehicle) => (
                    <div key={vehicle.id} className="bg-[#111215] border border-white/5 rounded-2xl p-5 relative overflow-hidden group border-b-2 border-b-transparent hover:border-b-[#00F2FE] transition-all shadow-xl">
                      <button
                        type="button"
                        onClick={() => handleRemoveVehicle(vehicle.id)}
                        className="absolute top-4 left-4 text-gray-500 hover:text-red-400 transition-all"
                        aria-label={`Remove ${vehicle.nickname}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="absolute top-4 right-4 text-[9px] font-mono bg-[#00F2FE]/10 text-[#00F2FE] px-2.5 py-0.5 rounded font-bold border border-[#00F2FE]/20 tracking-wider uppercase">
                        Saved
                      </div>
                      <div className="space-y-3">
                        {vehicle.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={vehicle.imageUrl}
                            alt={vehicle.nickname}
                            className="h-28 w-full object-cover rounded-xl border border-white/10"
                          />
                        ) : (
                          <div className="h-28 w-full rounded-xl border border-dashed border-white/10 flex items-center justify-center text-[10px] text-gray-500 font-mono uppercase">
                            No photo uploaded
                          </div>
                        )}
                        <div>
                          <h4 className="text-white text-base font-bold tracking-wide">{vehicle.nickname}</h4>
                          <p className="text-xs font-mono text-gray-400 mt-1">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-[11px] font-mono text-[#00F2FE] mt-1">{vehicle.horsepower} HP</p>
                        </div>
                        <p className="text-[10px] font-mono text-gray-500">{vehicle.modifications}</p>
                        <p className="text-[10px] font-mono text-gray-600 uppercase">{vehicle.ref}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "clubs" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/5 pb-4">
                <h2 className="text-xl font-bold text-white uppercase">Car Meets & Clubs</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Discover clubs, join communities, host meets, and track upcoming events.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div className="space-y-4">
                  <div className="bg-[#111215] border border-white/5 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-white uppercase mb-4">Find Clubs</h3>
                    <div className="space-y-3">
                      {filteredClubs.length === 0 ? (
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {clubs.length === 0
                            ? "No clubs yet. Create the first club to start building your community."
                            : "No clubs match your current search filter."}
                        </p>
                      ) : (
                        filteredClubs.map((club) => {
                          const organizerContactId = makeCommunityContactId(club.organizer);
                          const organizerIsFriend = friendIds.has(organizerContactId);
                          const organizerRequestPending =
                            pendingFriendRequestContactIds.has(organizerContactId);
                          return (
                            <div key={club.id} className="bg-[#16171b] border border-white/[0.04] rounded-xl p-4">
                              <div className="flex justify-between items-start gap-3">
                                <div>
                                  <h4 className="text-sm text-white font-semibold">{club.name}</h4>
                                  <p className="text-[10px] font-mono text-[#00F2FE] mt-0.5">{club.city}</p>
                                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                                    {club.description}
                                  </p>
                                  <p className="text-[10px] font-mono text-gray-500 mt-2">
                                    Organizer: {club.organizer}
                                  </p>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500">{club.members} members</span>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleClubToggle(club.id)}
                                  className={`py-2 rounded-xl text-[10px] font-mono uppercase tracking-wider font-bold transition-all ${
                                    club.isMember
                                      ? "bg-white/[0.04] border border-white/10 text-gray-300"
                                      : "bg-[#00F2FE] text-black"
                                  }`}
                                >
                                  {club.isMember ? "Leave Club" : "Join Club"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    requestFriendConnection(club.organizer, `Club • ${club.name}`)
                                  }
                                  disabled={organizerIsFriend || organizerRequestPending}
                                  className={`py-2 rounded-xl text-[10px] font-mono uppercase tracking-wider font-bold border transition-all disabled:opacity-40 ${
                                    organizerIsFriend
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                      : organizerRequestPending
                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                        : "bg-white/[0.04] border-white/10 text-gray-300 hover:text-white"
                                  }`}
                                >
                                  {organizerIsFriend
                                    ? "Friend Added"
                                    : organizerRequestPending
                                      ? "Request Sent"
                                      : "Add Organizer"}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleCreateClub} className="bg-[#111215] border border-white/5 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white uppercase">Create Club</h3>
                    <input
                      type="text"
                      placeholder="Club name"
                      value={clubForm.name}
                      onChange={(event) => setClubForm((previous) => ({ ...previous, name: event.target.value }))}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      required
                    />
                    <input
                      type="text"
                      placeholder="City"
                      value={clubForm.city}
                      onChange={(event) => setClubForm((previous) => ({ ...previous, city: event.target.value }))}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      required
                    />
                    <textarea
                      placeholder="What is your club about?"
                      value={clubForm.description}
                      onChange={(event) =>
                        setClubForm((previous) => ({ ...previous, description: event.target.value }))
                      }
                      rows={3}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                    />
                    <button className="w-full bg-[#00F2FE] text-black font-bold py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider">
                      Create Club
                    </button>
                  </form>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#111215] border border-white/5 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-white uppercase mb-4">Upcoming Meets</h3>
                    <div className="space-y-3">
                      {filteredMeets.length === 0 ? (
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {meets.length === 0
                            ? "No upcoming meets yet. Publish a meet below to get started."
                            : "No meets match your current search filter."}
                        </p>
                      ) : (
                        filteredMeets.map((meet) => {
                          const hostContactId = makeCommunityContactId(meet.host);
                          const hostIsFriend = friendIds.has(hostContactId);
                          const hostRequestPending =
                            pendingFriendRequestContactIds.has(hostContactId);
                          return (
                            <div key={meet.id} className="bg-[#16171b] border border-white/[0.04] rounded-xl p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="text-sm text-white font-semibold">{meet.title}</h4>
                                  <p className="text-[10px] font-mono text-gray-400 mt-1">{meet.location}</p>
                                  <p className="text-[10px] font-mono text-[#00F2FE] mt-1">{meet.club}</p>
                                  <p className="text-[10px] font-mono text-gray-500 mt-1">
                                    Host: {meet.host}
                                  </p>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500">{meet.attendees} going</span>
                              </div>
                              <div className="flex justify-between items-center mt-3">
                                <p className="text-[10px] font-mono text-gray-500">
                                  <CalendarDays className="inline h-3 w-3 mr-1" />
                                  {new Date(meet.date).toLocaleString()}
                                </p>
                                <button
                                  onClick={() => handleMeetToggle(meet.id)}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold ${
                                    meet.isGoing
                                      ? "bg-white/[0.04] border border-white/10 text-gray-300"
                                      : "bg-[#00F2FE] text-black"
                                  }`}
                                >
                                  {meet.isGoing ? "Going" : "RSVP"}
                                </button>
                              </div>
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => requestFriendConnection(meet.host, `Meet • ${meet.title}`)}
                                  disabled={hostIsFriend || hostRequestPending}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold border disabled:opacity-40 ${
                                    hostIsFriend
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                      : hostRequestPending
                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                        : "bg-white/[0.04] border-white/10 text-gray-300 hover:text-white"
                                  }`}
                                >
                                  {hostIsFriend
                                    ? "Friend Added"
                                    : hostRequestPending
                                      ? "Request Sent"
                                      : "Add Host"}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleHostMeet} className="bg-[#111215] border border-white/5 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white uppercase">Host a Meet</h3>
                    <input
                      type="text"
                      placeholder="Meet title"
                      value={meetForm.title}
                      onChange={(event) => setMeetForm((previous) => ({ ...previous, title: event.target.value }))}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Location"
                      value={meetForm.location}
                      onChange={(event) => setMeetForm((previous) => ({ ...previous, location: event.target.value }))}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      required
                    />
                    <input
                      type="datetime-local"
                      value={meetForm.date}
                      onChange={(event) => setMeetForm((previous) => ({ ...previous, date: event.target.value }))}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Club name (optional)"
                      value={meetForm.club}
                      onChange={(event) => setMeetForm((previous) => ({ ...previous, club: event.target.value }))}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                    />
                    <button className="w-full bg-[#00F2FE] text-black font-bold py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider">
                      Publish Meet
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {activeTab === "friends" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/5 pb-4">
                <h2 className="text-xl font-bold text-white uppercase">Friends & Messages</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Add contacts from clubs/meets, approve requests, and chat privately with friends.
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
                <div className="bg-[#111215] border border-white/5 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white uppercase mb-4">People From Clubs & Meets</h3>
                  {communityContacts.length === 0 ? (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      No discoverable contacts yet. Join clubs or meets to discover people.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                      {communityContacts.map((contact) => {
                        const isFriend = friendIds.has(contact.id);
                        const hasPendingRequest = pendingFriendRequestContactIds.has(contact.id);
                        return (
                          <div key={contact.id} className="bg-[#16171b] border border-white/[0.04] rounded-xl p-3">
                            <p className="text-sm text-white font-semibold">{contact.handle}</p>
                            <p className="text-[10px] font-mono text-gray-500 mt-1">
                              {contact.sourceLabel}
                            </p>
                            <button
                              type="button"
                              onClick={() => requestFriendConnection(contact.handle, contact.sourceLabel)}
                              disabled={isFriend || hasPendingRequest}
                              className={`w-full mt-3 py-2 rounded-lg text-[10px] font-mono uppercase font-bold border disabled:opacity-40 ${
                                isFriend
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                  : hasPendingRequest
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                    : "bg-white/[0.04] border-white/10 text-gray-300 hover:text-white"
                              }`}
                            >
                              {isFriend ? "Friend Added" : hasPendingRequest ? "Request Sent" : "Send Friend Request"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-[#111215] border border-white/5 rounded-2xl p-5 space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase mb-3">Pending Requests</h3>
                    {friendRequests.length === 0 ? (
                      <p className="text-xs text-gray-500">No pending friend requests.</p>
                    ) : (
                      <div className="space-y-2">
                        {friendRequests.map((request) => (
                          <div
                            key={request.id}
                            className="bg-[#16171b] border border-white/[0.04] rounded-xl p-3"
                          >
                            <p className="text-xs text-white font-semibold">{request.handle}</p>
                            <p className="text-[10px] font-mono text-gray-500 mt-1">{request.sourceLabel}</p>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <button
                                type="button"
                                onClick={() => acceptFriendRequest(request.id)}
                                className="py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold bg-[#00F2FE] text-black"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelFriendRequest(request.id)}
                                className="py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold bg-white/[0.04] border border-white/10 text-gray-300"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white uppercase mb-3">Friends</h3>
                    {friends.length === 0 ? (
                      <p className="text-xs text-gray-500">No friends added yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {friends.map((friend) => (
                          <div
                            key={friend.id}
                            className={`bg-[#16171b] border rounded-xl p-3 ${
                              selectedFriendId === friend.id
                                ? "border-[#00F2FE]/30"
                                : "border-white/[0.04]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedFriendId(friend.id)}
                              className="w-full text-left"
                            >
                              <p className="text-xs text-white font-semibold">{friend.handle}</p>
                              <p className="text-[10px] font-mono text-gray-500 mt-1">
                                Connected {formatTimeAgo(friend.connectedAt)}
                              </p>
                            </button>
                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeFriend(friend.id)}
                                className="text-[10px] font-mono uppercase text-gray-400 hover:text-white"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#111215] border border-white/5 rounded-2xl p-5 flex flex-col">
                  <h3 className="text-sm font-bold text-white uppercase mb-3">Private Messages</h3>
                  {!selectedFriend ? (
                    <p className="text-xs text-gray-500">
                      Select a friend to start private messaging.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between bg-[#16171b] border border-white/[0.04] rounded-xl px-3 py-2">
                        <p className="text-xs font-semibold text-white">{selectedFriend.handle}</p>
                        <p className="text-[10px] font-mono text-gray-500">{selectedFriend.sourceLabel}</p>
                      </div>

                      <div className="mt-3 flex-1 bg-[#16171b] border border-white/[0.04] rounded-xl p-3 space-y-2 overflow-y-auto min-h-[360px] max-h-[360px]">
                        {selectedFriendMessages.length === 0 ? (
                          <p className="text-[10px] text-gray-500">No messages yet. Send the first one.</p>
                        ) : (
                          selectedFriendMessages.map((message) => (
                            <div
                              key={message.id}
                              className={`max-w-[90%] rounded-lg px-3 py-2 ${
                                message.sender === "me"
                                  ? "ml-auto bg-[#00F2FE]/15 border border-[#00F2FE]/30 text-[#7cecf3]"
                                  : "mr-auto bg-black/25 border border-white/10 text-gray-300"
                              }`}
                            >
                              <p className="text-[11px] leading-relaxed">{message.text}</p>
                              <p className="text-[9px] font-mono text-gray-500 mt-1">
                                {new Date(message.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <form
                        className="mt-3 flex items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!selectedFriendId) return;
                          sendDirectMessageToFriend(selectedFriendId);
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Send a private message..."
                          value={selectedFriendId ? messageDrafts[selectedFriendId] ?? "" : ""}
                          onChange={(event) => {
                            if (!selectedFriendId) return;
                            const nextValue = event.target.value;
                            setMessageDrafts((previous) => ({
                              ...previous,
                              [selectedFriendId]: nextValue,
                            }));
                          }}
                          className="flex-1 bg-[#16171b] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 bg-[#00F2FE] text-black font-bold py-2 px-3 rounded-xl text-[10px] font-mono uppercase"
                        >
                          <SendHorizonal className="h-3 w-3" /> Send
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <form onSubmit={handleProfileSave} className="bg-[#111215] border border-white/5 rounded-2xl p-8 max-w-3xl animate-fadeIn shadow-xl space-y-6">
              <h2 className="text-xl font-bold tracking-wide text-white uppercase border-b border-white/5 pb-3">
                Profile Settings
              </h2>

              <div className="bg-black/20 p-4 rounded-xl border border-white/[0.02]">
                <p className="text-white font-bold text-sm mb-3">Profile Picture</p>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full border border-white/10 overflow-hidden bg-[#16171b] flex items-center justify-center">
                    {profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profileImageUrl} alt="Profile preview" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-[#00F2FE]">{profileInitials}</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageChange}
                    className="bg-[#16171b] border border-white/10 rounded-xl py-2 px-3 text-xs text-gray-300 focus:border-[#00F2FE]/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.displayName}
                    onChange={(event) =>
                      setProfileForm((previous) => ({ ...previous, displayName: event.target.value }))
                    }
                    className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) => setProfileForm((previous) => ({ ...previous, email: event.target.value }))}
                    className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(event) => setProfileForm((previous) => ({ ...previous, phone: event.target.value }))}
                    className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={profileForm.city}
                    onChange={(event) => setProfileForm((previous) => ({ ...previous, city: event.target.value }))}
                    className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
                  Bio
                </label>
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(event) => setProfileForm((previous) => ({ ...previous, bio: event.target.value }))}
                  className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 p-4 rounded-xl border border-white/[0.02]">
                  <p className="text-white font-bold text-sm">Telemetry Units</p>
                  <select
                    value={profileForm.preferredUnits}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        preferredUnits: event.target.value,
                      }))
                    }
                    className="mt-3 w-full bg-[#16171b] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                  >
                    <option value="imperial">Imperial (MPH / mi)</option>
                    <option value="metric">Metric (km/h / km)</option>
                  </select>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/[0.02] space-y-3">
                  <label className="flex items-center justify-between text-xs text-gray-300">
                    Friend request notifications
                    <input
                      type="checkbox"
                      checked={profileForm.receiveFriendRequests}
                      onChange={(event) =>
                        setProfileForm((previous) => ({
                          ...previous,
                          receiveFriendRequests: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs text-gray-300">
                    Convoy status notifications
                    <input
                      type="checkbox"
                      checked={profileForm.receiveConvoyUpdates}
                      onChange={(event) =>
                        setProfileForm((previous) => ({
                          ...previous,
                          receiveConvoyUpdates: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="bg-black/20 p-4 rounded-xl border border-white/[0.02] space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#00F2FE]" />
                  <p className="text-white font-bold text-sm">Subscription</p>
                </div>

                {isSiteAdmin ? (
                  <p className="text-xs text-amber-300 font-mono">
                    Site owner access • {tierLabel(effectiveUserTier)} privileges • route moderation enabled
                  </p>
                ) : subscriptionForm.active ? (
                  <p className="text-xs text-emerald-400 font-mono">
                    Active plan:{" "}
                    {SUBSCRIPTION_PLANS.find((plan) => plan.id === subscriptionForm.plan)?.label ??
                      subscriptionForm.plan.toUpperCase()}{" "}
                    • Tier: {tierLabel(effectiveUserTier)}
                    {subscriptionForm.startedAt
                      ? ` • Renews ${new Date(subscriptionForm.startedAt).toLocaleDateString()}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">
                    Current tier: {tierLabel(effectiveUserTier)}. Upgrade to unlock premium features.
                  </p>
                )}

                <p className="text-xs text-gray-400">
                  {subscriptionForm.active
                    ? "Select a different plan to change your subscription."
                    : "Select a paid plan to subscribe through Stripe checkout."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SUBSCRIPTION_PLANS.map((plan) => {
                    const isCurrentPlan =
                      plan.id === "starter"
                        ? !subscriptionForm.active && subscriptionForm.plan === "starter"
                        : subscriptionForm.active && subscriptionForm.plan === plan.id;

                    return (
                      <button
                        key={plan.id}
                        type="button"
                        disabled={isCheckoutLoading || isBillingPortalLoading || isCurrentPlan}
                        onClick={() => void startSubscriptionCheckout(plan.id)}
                        className={`border rounded-xl px-2 py-2 text-[10px] font-mono uppercase transition-all hover:border-[#00F2FE]/40 disabled:opacity-50 ${
                          isCurrentPlan
                            ? "border-[#00F2FE]/50 bg-[#00F2FE]/10 text-[#00F2FE]"
                            : "border-white/10 text-gray-400"
                        }`}
                      >
                        {isCurrentPlan ? "Current Plan" : plan.label}
                        <span className="block mt-0.5 text-[9px] normal-case">{plan.price}</span>
                      </button>
                    );
                  })}
                </div>

                {(isCheckoutLoading || isBillingPortalLoading) && (
                  <p className="text-[10px] font-mono uppercase text-[#00F2FE]">
                    {isCheckoutLoading ? "Opening checkout..." : "Opening billing portal..."}
                  </p>
                )}

                {stripeBilling.customerId && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isBillingPortalLoading || isCheckoutLoading}
                      onClick={() => void openBillingPortal()}
                      className="bg-white/[0.04] border border-white/10 text-gray-200 font-bold py-2.5 px-4 rounded-xl text-[10px] font-mono uppercase tracking-wider hover:text-white transition-all min-h-[44px] disabled:opacity-50"
                    >
                      Change Payment Method
                    </button>
                    {subscriptionForm.active && (
                      <button
                        type="button"
                        disabled={isBillingPortalLoading || isCheckoutLoading}
                        onClick={() => void openBillingPortal()}
                        className="bg-white/[0.04] border border-amber-500/30 text-amber-300 font-bold py-2.5 px-4 rounded-xl text-[10px] font-mono uppercase tracking-wider hover:text-amber-200 transition-all min-h-[44px] disabled:opacity-50"
                      >
                        Cancel Subscription
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isRouteModerator && (
                <div className="bg-black/20 p-4 rounded-xl border border-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white font-bold text-sm">Admin Route Moderation</p>
                    <span className="text-[10px] font-mono text-amber-300 uppercase tracking-wide">
                      {pendingRouteSubmissionCount} pending
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Approve or reject user-submitted community routes before they go live for all
                    drivers.
                  </p>
                  <Link
                    href="/admin"
                    className="inline-flex items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-200 font-bold py-2.5 px-4 rounded-xl text-[10px] font-mono uppercase tracking-wider hover:text-amber-100 transition-all min-h-[44px]"
                  >
                    Open Admin Dashboard
                  </Link>
                  {routeSubmissions.length === 0 ? (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      No route submissions are waiting for review.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                      {routeSubmissions.map((submission) => (
                        <div
                          key={submission.id}
                          className="bg-[#16171b] border border-white/[0.04] rounded-xl p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-white">{submission.name}</p>
                              <p className="text-[10px] font-mono text-gray-500 mt-1">
                                {submission.startLabel} → {submission.endLabel}
                              </p>
                              {submission.notes && (
                                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                                  {submission.notes}
                                </p>
                              )}
                              <p className="text-[9px] font-mono text-gray-600 mt-1">
                                Submitted {formatTimeAgo(submission.submittedAt)}
                                {submission.submitterEmail
                                  ? ` • ${submission.submitterEmail}`
                                  : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-[9px] font-mono uppercase ${
                                  submission.status === "approved"
                                    ? "text-emerald-400"
                                    : submission.status === "rejected"
                                      ? "text-rose-400"
                                      : "text-amber-300"
                                }`}
                              >
                                {submission.status}
                              </p>
                              {submission.status === "pending" && (
                                <div className="mt-2 flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => approveRouteSubmission(submission.id)}
                                    className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2 py-1 rounded-lg text-[9px] font-mono uppercase font-bold"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => rejectRouteSubmission(submission.id)}
                                    className="bg-rose-500/15 border border-rose-500/30 text-rose-300 px-2 py-1 rounded-lg text-[9px] font-mono uppercase font-bold"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-white/5">
                <button
                  type="submit"
                  disabled={isProfileSaving}
                  className="bg-[#00F2FE] text-black font-bold py-2.5 px-6 rounded-xl text-xs font-mono uppercase tracking-wider min-h-[44px] disabled:opacity-50"
                >
                  {isProfileSaving ? "Saving Profile..." : "Save Profile"}
                </button>
                <SignOutButton redirectUrl="/sign-in">
                  <button
                    type="button"
                    className="bg-white/[0.04] border border-rose-500/30 text-rose-300 font-bold py-2.5 px-6 rounded-xl text-xs font-mono uppercase tracking-wider hover:text-rose-200 hover:border-rose-400/40 transition-all min-h-[44px]"
                  >
                    Sign Out
                  </button>
                </SignOutButton>
              </div>

              <div className="bg-black/20 p-4 rounded-xl border border-rose-500/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-rose-400" />
                  <p className="text-white font-bold text-sm">Delete Account</p>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Permanently remove your Apex Drive account, cancel any active subscription, and
                  delete associated billing data. This action cannot be undone.
                </p>
                <button
                  type="button"
                  disabled={isDeleteAccountLoading}
                  onClick={() => setIsDeleteAccountModalOpen(true)}
                  className="bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold py-2.5 px-4 rounded-xl text-[10px] font-mono uppercase tracking-wider hover:text-rose-200 hover:border-rose-400/40 transition-all min-h-[44px] disabled:opacity-50"
                >
                  Delete Account
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      {isVehicleModalOpen && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setIsVehicleModalOpen(false)}
        >
          <div
            className="bg-[#111215] border border-white/10 rounded-2xl w-full max-w-[520px] mx-4 p-6 shadow-2xl relative"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setIsVehicleModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-bold text-white mb-4 tracking-wide border-b border-white/5 pb-2 uppercase font-mono">
              Register Vehicle
            </h3>
            <form onSubmit={handleAddVehicleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Year"
                  value={vehicleForm.year}
                  onChange={(event) => setVehicleForm((previous) => ({ ...previous, year: event.target.value }))}
                  className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                  required
                />
                <input
                  type="text"
                  placeholder="Make"
                  value={vehicleForm.make}
                  onChange={(event) => setVehicleForm((previous) => ({ ...previous, make: event.target.value }))}
                  className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                  required
                />
                <input
                  type="text"
                  placeholder="Model"
                  value={vehicleForm.model}
                  onChange={(event) => setVehicleForm((previous) => ({ ...previous, model: event.target.value }))}
                  className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                  required
                />
                <input
                  type="text"
                  placeholder="Car nickname"
                  value={vehicleForm.nickname}
                  onChange={(event) =>
                    setVehicleForm((previous) => ({ ...previous, nickname: event.target.value }))
                  }
                  className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                  required
                />
                <input
                  type="text"
                  placeholder="Horsepower"
                  value={vehicleForm.horsepower}
                  onChange={(event) =>
                    setVehicleForm((previous) => ({ ...previous, horsepower: event.target.value }))
                  }
                  className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleVehicleImageChange}
                  className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2 px-3 text-xs text-gray-300 focus:border-[#00F2FE]/40 focus:outline-none"
                />
              </div>
              <textarea
                placeholder="Modifications"
                value={vehicleForm.modifications}
                onChange={(event) =>
                  setVehicleForm((previous) => ({ ...previous, modifications: event.target.value }))
                }
                rows={3}
                className="w-full bg-[#16171b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:border-[#00F2FE]/40 focus:outline-none"
              />
              {vehicleForm.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={vehicleForm.imageUrl}
                  alt="Vehicle preview"
                  className="h-32 w-full object-cover rounded-xl border border-white/10"
                />
              )}
              <button
                type="submit"
                className="w-full bg-[#00F2FE] text-black font-semibold py-2.5 rounded-xl text-xs hover:opacity-90 transition-all font-mono uppercase tracking-wider mt-2"
              >
                Save To Garage
              </button>
            </form>
          </div>
        </div>
      )}

      {isDeleteAccountModalOpen && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => {
            if (!isDeleteAccountLoading) setIsDeleteAccountModalOpen(false);
          }}
        >
          <div
            className="bg-[#111215] border border-rose-500/30 rounded-2xl w-full max-w-[460px] mx-4 p-6 shadow-2xl relative"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              disabled={isDeleteAccountLoading}
              onClick={() => setIsDeleteAccountModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-all disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="h-4 w-4 text-rose-400" />
              <h3 className="text-base font-bold text-white uppercase font-mono">
                Delete Account?
              </h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              This permanently removes your Apex Drive account, cancels any active subscription,
              and deletes your profile data. This cannot be undone.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled={isDeleteAccountLoading}
                onClick={() => void handleDeleteAccount()}
                className="bg-rose-500/20 border border-rose-500/40 text-rose-200 font-bold py-2 px-4 rounded-xl text-xs font-mono uppercase disabled:opacity-50"
              >
                {isDeleteAccountLoading ? "Deleting..." : "Yes, Delete Permanently"}
              </button>
              <button
                type="button"
                disabled={isDeleteAccountLoading}
                onClick={() => setIsDeleteAccountModalOpen(false)}
                className="bg-white/[0.04] border border-white/10 text-gray-300 font-bold py-2 px-4 rounded-xl text-xs font-mono uppercase disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isTierGateModalOpen && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setIsTierGateModalOpen(false)}
        >
          <div
            className="bg-[#111215] border border-amber-500/30 rounded-2xl w-full max-w-[460px] mx-4 p-6 shadow-2xl relative"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsTierGateModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-4 w-4 text-amber-400" />
              <h3 className="text-base font-bold text-white uppercase font-mono">Tier Upgrade Required</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{tierGateMessage}</p>
            <p className="text-[10px] font-mono text-gray-500 mt-3 uppercase">
              Current tier: {tierLabel(effectiveUserTier)}
              {isSiteAdmin ? " • Site Admin" : ""}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsTierGateModalOpen(false);
                  setActiveTab("settings");
                }}
                className="bg-[#00F2FE] text-black font-bold py-2 px-4 rounded-xl text-xs font-mono uppercase"
              >
                View Plans
              </button>
              <button
                type="button"
                onClick={() => setIsTierGateModalOpen(false)}
                className="bg-white/[0.04] border border-white/10 text-gray-300 font-bold py-2 px-4 rounded-xl text-xs font-mono uppercase"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
