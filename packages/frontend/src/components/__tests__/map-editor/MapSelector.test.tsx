import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MapSumaryRespBody } from "@generale/types";
import type { JSX } from "solid-js";
import { render, screen } from "@solidjs/testing-library";
type MockProps = { children?: JSX.Element; [key: string]: unknown };

vi.mock("~/api/mapApi", () => ({
  listMapsApi: vi.fn(),
  mapThumbnailUrl: vi.fn(),
}));

vi.mock("~/ui", () => ({
  Collapse: (p: MockProps) => <div {...p} />,
  CollapseContent: (p: MockProps) => <div {...p} />,
  CollapseTitle: (p: MockProps) => <div {...p} />,
  Checkbox: () => null,
  Input: (p: MockProps) => <input {...p} />,
  Button: (p: MockProps) => <button {...p}>{p.children}</button>,
  Spinner: () => <div>Loading...</div>,
}));

import { listMapsApi, mapThumbnailUrl } from "~/api/mapApi";
import { MapSelector } from "~/components/map-editor/MapSelector";

const maps: MapSumaryRespBody[] = [
  {
    id: "m1",
    gameType: "generale",
    name: "Alpha",
    authorId: "u1",
    authorName: "User1",
    width: 20,
    height: 20,
    minPlayers: 2,
    maxPlayers: 4,
    isPublic: true,
    isDraft: false,
    usageCount: 0,
    tags: [],
  },
  {
    id: "m2",
    gameType: "generale",
    name: "Beta",
    authorId: "u2",
    authorName: "User2",
    width: 30,
    height: 30,
    minPlayers: 2,
    maxPlayers: 6,
    isPublic: true,
    isDraft: false,
    usageCount: 0,
    tags: [],
  },
];

beforeEach(() => {
  vi.mocked(listMapsApi).mockResolvedValue({ success: true, data: maps });
  vi.mocked(mapThumbnailUrl).mockImplementation((id) => `/api/maps/thumbnail/${id}`);
});

describe("MapSelector", () => {
  it("renders placeholder when no map selected", () => {
    render(() => <MapSelector value="" onChange={vi.fn()} />);
    expect(screen.getByText("Select a map…")).toBeInTheDocument();
  });

  it("renders placeholder text", () => {
    render(() => <MapSelector value="" onChange={vi.fn()} placeholder="Pick a map" />);
    expect(screen.getByText("Pick a map")).toBeInTheDocument();
  });

  it("renders clear button", () => {
    render(() => <MapSelector value="m1" onChange={vi.fn()} />);
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(() => <MapSelector value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
  });
});
