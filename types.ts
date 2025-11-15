export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Result {
  id: string;
  source: string;
  summary: string;
  groundingChunks: GroundingChunk[];
  timestamp: number;
}

export interface FavoriteItem {
  id: string;
  text: string;
  source: string;
  timestamp: number;
}
