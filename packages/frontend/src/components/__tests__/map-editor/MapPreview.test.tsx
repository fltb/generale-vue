import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MapDetailRespBody } from "@generale/types";
import type { JSX } from "solid-js";
import { render, screen, waitFor } from "@solidjs/testing-library";
type MockProps = { children?: JSX.Element; [key: string]: unknown };
vi.mock("solid-pixi", () => ({
  Application: (p: MockProps) => p.children ?? null,
  Container: (p: MockProps) => p.children ?? null,
  Graphics: () => null,
  Text: () => null,
}));

vi.mock("pixi.js", () => ({
  Graphics: vi.fn(() => ({
    clear: vi.fn(),
    removeChildren: vi.fn(),
    addChild: vi.fn(() => ({ x: 0, y: 0 })),
    rect: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
  })),
  TextStyle: vi.fn(() => ({})),
}));

vi.mock("~/utils/faIconGraphic", () => ({
  createIconFactory: () => ({
    createScaledIcon: vi.fn(() => ({ x: 0, y: 0 })),
    destroy: vi.fn(),
  }),
}));

vi.mock("~/api/mapApi", () => ({
  mapDetailApi: vi.fn(),
  mapThumbnailUrl: vi.fn(),
}));

vi.mock("~/components/MapTile", () => ({
  MapTile: () => null,
}));

vi.mock("@solidjs/router", () => ({
  A: (p: MockProps) => <a {...p}>{p.children}</a>,
  useNavigate: () => vi.fn(),
  useSearchParams: () => [() => ({}), vi.fn()],
}));


import { mapDetailApi } from "~/api/mapApi";
import MapPreview from "~/components/map-editor/MapPreview";

const detail: MapDetailRespBody = {
  id: "map1",
  gameType: "generale",
  name: "Test Map",
  authorId: "author1",
  authorName: "Author",
  width: 10,
  height: 10,
  minPlayers: 2,
  maxPlayers: 4,
  isPublic: true,
  isDraft: false,
  usageCount: 0,
  tags: [],
  data: Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => ({ type: "PLAIN", army: 0 })),
  ),
};

beforeEach(() => {
  vi.mocked(mapDetailApi).mockResolvedValue({ success: true, data: detail });
});
describe("MapPreview", () => {
  it("shows loading state initially", () => {
    render(() => <MapPreview mapId="map1" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders map name after loading", async () => {
    render(() => <MapPreview mapId="map1" />);
    await waitFor(() => {
      expect(screen.getByText("Test Map")).toBeInTheDocument();
    });
  });

  it("renders dimensions after loading", async () => {
    render(() => <MapPreview mapId="map1" />);
    await waitFor(() => {
      expect(screen.getByText("10×10")).toBeInTheDocument();
    });
  });

  it("renders back link", () => {
    render(() => <MapPreview mapId="map1" />);
    expect(screen.getByText("← Back")).toBeInTheDocument();
  });
});
