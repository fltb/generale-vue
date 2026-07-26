import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import type { JSX } from "solid-js";

type AnchorProps = { href?: string; children?: JSX.Element };
type MapEditorProps = { mapId?: string };
vi.mock("@solidjs/meta", () => ({ Title: () => null, Meta: () => null }));

vi.mock("~/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "1" }, isLoading: false }) }));

vi.mock("@solidjs/router", () => ({
  A: (props: AnchorProps) => <a href={props.href}>{props.children}</a>,
  useLocation: () => ({ pathname: "/maps/editor" }),
  useParams: () => ({ id: "map-123" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("~/components/map-editor/MapEditor", () => ({
  default: (p: MapEditorProps) => <div data-testid="map-editor">MapEditor mapId={p.mapId}</div>,
}));

import MapEditorPage from "../map-editor";

describe("MapEditor route", () => {
  it("renders MapEditor component", () => {
    render(() => <MapEditorPage />);
    expect(screen.getByTestId("map-editor")).toBeInTheDocument();
    expect(screen.getByText(/map-123/)).toBeInTheDocument();
  });
});
