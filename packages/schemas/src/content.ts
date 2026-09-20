export type ContentType =
  | "video_transcript"
  | "article"
  | "web_page"
  | "pdf"
  | "selection";

/** Stable cross-provider identity before full Content metadata is acquired. */
export interface ContentRef {
  source: string;
  sourceId: string;
  segmentId?: string;
  url?: string;
}

export interface Content {
  id: string;
  type: ContentType;
  source: string;
  sourceId: string;
  title: string;
  author?: string;
  url?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

