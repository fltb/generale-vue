import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Label, LabelText, LabelTextAlt } from "../Label";

describe("Label", () => {
  it("renders children, text, and alt text", () => {
    render(() => <Label text="Email" alt="Optional"><span>child</span></Label>);
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("renders label class", () => {
    render(() => <Label text="X" />);
    expect(screen.getByText("X").parentElement).toHaveClass("label");
  });
});

describe("LabelText", () => {
  it("renders label-text class", () => {
    render(() => <LabelText>Text</LabelText>);
    expect(screen.getByText("Text")).toHaveClass("label-text");
  });
});

describe("LabelTextAlt", () => {
  it("renders label-text-alt class", () => {
    render(() => <LabelTextAlt>Alt</LabelTextAlt>);
    expect(screen.getByText("Alt")).toHaveClass("label-text-alt");
  });
});
