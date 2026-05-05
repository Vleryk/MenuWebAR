import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CategoryTabs from "../components/CategoryTabs";

describe("CategoryTabs", () => {
  const categories = [
    { id: "entradas", label: "Entradas" },
    { id: "platos", label: "Platos Principales" },
    { id: "bebidas", label: "Bebidas" },
  ];

  let onChange;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it("renders all category buttons", () => {
    render(<CategoryTabs categories={categories} activeCategory="entradas" onChange={onChange} />);

    expect(screen.getByText("Entradas")).toBeInTheDocument();
    expect(screen.getByText("Platos Principales")).toBeInTheDocument();
    expect(screen.getByText("Bebidas")).toBeInTheDocument();
  });

  it("calls onChange when a tab is clicked", () => {
    render(<CategoryTabs categories={categories} activeCategory="entradas" onChange={onChange} />);

    fireEvent.click(screen.getByText("Bebidas"));
    expect(onChange).toHaveBeenCalledWith("bebidas");
  });

  it("renders empty when no categories", () => {
    const { container } = render(
      <CategoryTabs categories={[]} activeCategory="" onChange={onChange} />,
    );

    const nav = container.querySelector("nav");
    expect(nav).toBeInTheDocument();
    expect(nav.children.length).toBe(0);
  });
});
