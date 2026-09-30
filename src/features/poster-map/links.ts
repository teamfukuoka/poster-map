import type { MapBoard } from "./types";

export function mapLinks(board: Pick<MapBoard, "name" | "lat" | "long">): {
  google: string;
  apple: string;
} {
  const ll = `${board.lat},${board.long}`;
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${ll}`,
    apple: `https://maps.apple.com/?q=${encodeURIComponent(board.name)}&ll=${ll}`,
  };
}
