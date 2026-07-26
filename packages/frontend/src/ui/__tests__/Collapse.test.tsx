import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Collapse, CollapseContent, CollapseTitle } from "../Collapse";

describe("Collapse", () => {
  it.each([
    ["default", false, "pixel-border"],
    ["arrow", true, "collapse-arrow"],
  ] as const)("%s state renders its expected class and children", (_name, arrow, expectedClass) => {
    render(() => <Collapse arrow={arrow}><div>content</div></Collapse>);
    const content = screen.getByText("content");
    expect(content).toBeInTheDocument();
    expect(content.parentElement).toHaveClass(expectedClass);
  });

  it("merges custom class", () => {
    render(() => <Collapse class="my-custom"><div>content</div></Collapse>);
    expect(screen.getByText("content").parentElement).toHaveClass("my-custom");
  });
});

describe("CollapseTitle", () => {
  it("renders with collapse-title class", () => {
    render(() => <CollapseTitle>Title</CollapseTitle>);
    expect(screen.getByText("Title")).toHaveClass("collapse-title");
  });
});

describe("CollapseContent", () => {
  it("renders with collapse-content class", () => {
    render(() => <CollapseContent>Body</CollapseContent>);
    expect(screen.getByText("Body")).toHaveClass("collapse-content");
  });
});

describe("CollapseTitle", () => {
  it("renders with collapse-title class", () => {
    render(() => <CollapseTitle>Title</CollapseTitle>);
    expect(screen.getByText("Title")).toHaveClass("collapse-title");
  });
});

describe("CollapseContent", () => {
  it("renders with collapse-content class", () => {
    render(() => <CollapseContent>Body</CollapseContent>);
    expect(screen.getByText("Body")).toHaveClass("collapse-content");
  });
});
