import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Modal } from "../Modal";

describe("Modal", () => {
  it("renders children with open and pixel-border states", () => {
    render(() => <Modal>Content</Modal>);
    const content = screen.getByText("Content");
    expect(content).toBeInTheDocument();
    expect(content.parentElement).toHaveClass("modal-open");
    expect(content).toHaveClass("pixel-border");
  });

  it("applies boxClass to the modal box", () => {
    render(() => <Modal boxClass="max-w-2xl">Content</Modal>);
    expect(screen.getByText("Content")).toHaveClass("max-w-2xl");
  });
});
