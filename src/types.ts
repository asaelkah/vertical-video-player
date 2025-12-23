export type MomentType = "video" | "image" | "ad" | "youtube";

export interface MomentTaxonomy {
  league?: string;
  team?: string;
  player?: string;
  [k: string]: string | undefined;
}

export interface MomentBase {
  content_id: string;
  type: MomentType;
  title?: string;
  taxonomy?: MomentTaxonomy;
  duration_ms?: number;
  tags?: string[]; // For recommendation engine
  globalPopularity?: number; // 0-1 trending score
}

export interface VideoMoment extends MomentBase {
  type: "video";
  src: string;
  poster?: string;
  vtt?: string;
  max_seconds?: number; // <= 60
}

export interface ImageMoment extends MomentBase {
  type: "image";
  src: string;
  duration_ms?: number; // default 5000
}

export interface AdMoment extends MomentBase {
  type: "ad";
  src: string; // video source
  poster?: string;
  sponsor: {
    name: string;
    logo?: string;
    ctaText: string;
    ctaUrl: string;
  };
  vastTagUrl?: string;
  adId?: string;
}

export interface YouTubeMoment extends MomentBase {
  type: "youtube";
  videoId: string; // YouTube video ID (e.g., "QLzimuSJbIk")
  poster?: string;
}

export type Moment = VideoMoment | ImageMoment | AdMoment | YouTubeMoment;

export interface PlaylistPayload {
  playlist_id: string;
  title: string;
  moments: Moment[];
  context: {
    page_url: string;
    league?: string;
    team?: string;
    player?: string;
  };
}
