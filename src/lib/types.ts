/** Shapes shared by the API routes and the browser. Contains no server code. */

export type DayStatus = "upcoming" | "open" | "closed";

export type SessionMode = "daily" | "event";

export interface DayInfo {
  code: string;
  mode: SessionMode;
  status: DayStatus;
  opens_at: string;
  closes_at: string;
  timezone: string;
  gallery_visible: boolean;
}

export interface Photo {
  id: string;
  kind: "photo" | "video";
  taken_by: string | null;
  taken_at: string;
  thumb_url: string;
  full_url: string;
}

export interface GalleryResponse {
  day: DayInfo;
  photos: Photo[];
}

export interface Quota {
  used: number;
  limit: number;
  video_used: number;
  video_limit: number;
}
