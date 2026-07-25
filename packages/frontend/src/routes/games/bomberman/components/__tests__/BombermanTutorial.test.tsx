import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { BombermanTutorial } from "../BombermanTutorial";

describe("BombermanTutorial", () => {
  it("renders nothing when closed", () => {
    render(() => <BombermanTutorial open={false} onClose={vi.fn()} />);
    expect(screen.queryByText("bomberman.tutorial")).not.toBeInTheDocument();
  });

  it("renders content when open", () => {
    render(() => <BombermanTutorial open={true} onClose={vi.fn()} />);
    expect(screen.getByText("bomberman.tutorial")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(() => <BombermanTutorial open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "bomberman.close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders all nine item descriptions", () => {
    render(() => <BombermanTutorial open={true} onClose={vi.fn()} />);
    expect(screen.getByText("bomberman.tutorial.bombUp")).toBeInTheDocument();
    expect(screen.getByText("bomberman.tutorial.fireUp")).toBeInTheDocument();
    expect(screen.getByText("bomberman.tutorial.speedUp")).toBeInTheDocument();
    expect(screen.getByText("bomberman.tutorial.kick")).toBeInTheDocument();
    expect(screen.getByText("bomberman.tutorial.glove")).toBeInTheDocument();
    expect(screen.getByText("bomberman.tutorial.punch")).toBeInTheDocument();
    expect(screen.getByText("bomberman.tutorial.remote")).toBeInTheDocument();
    expect(screen.getByText("bomberman.tutorial.pierce")).toBeInTheDocument();
    expect(screen.getByText("bomberman.tutorial.spirit")).toBeInTheDocument();
  });
});
