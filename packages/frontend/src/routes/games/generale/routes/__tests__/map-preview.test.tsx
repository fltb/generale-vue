import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/meta", () => ({ Title: () => null, Meta: () => null }));

vi.mock("~/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "1" }, isLoading: false }) }));

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: unknown }) => <a href={props.href}>{props.children}</a>,
  useParams: () => ({ id: "preview-456" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("~/components/map-editor/MapPreview", () => ({
  default: (props: { mapId: string }) => <div data-testid="map-preview">MapPreview mapId={props.mapId}</div>,
}));
vi.mock("~/routes/games/generale/components/roomlist/CreateRoomModal", () => ({
  default: () => null,
}));


import MapPreviewPage from "../map-preview";

describe("MapPreview route", () => {
  it("renders MapPreview component", () => {
    render(() => <MapPreviewPage />);
    expect(screen.getByTestId("map-preview")).toBeInTheDocument();
    expect(screen.getByText(/preview-456/)).toBeInTheDocument();
  });
});
