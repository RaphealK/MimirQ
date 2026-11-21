// @vitest-environment happy-dom

import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataTable } from "./data-table";

describe("scrollable tables", () => {
  let host: HTMLDivElement;
  let root: Root;
  let viewport: HTMLDivElement;
  let clientWidth: number;
  let tableWidth: number;
  let notifyResize: () => void;
  const observe = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }
        observe = observe;
        disconnect() {}
      },
    );
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const table = createRef<HTMLTableElement>();
    act(() =>
      root.render(
        <DataTable ref={table} aria-label="文档列表">
          <tbody>
            <tr>
              <td>
                <input type="checkbox" />
              </td>
            </tr>
          </tbody>
        </DataTable>,
      ),
    );
    viewport = host.querySelector<HTMLDivElement>('[role="region"]')!;
    expect(table.current?.parentElement).toBe(viewport);
    expect(observe).toHaveBeenCalledWith(viewport);
    expect(observe).toHaveBeenCalledWith(table.current);
    clientWidth = 390;
    tableWidth = 700;
    Object.defineProperties(viewport, {
      clientWidth: { get: () => clientWidth },
      scrollWidth: { get: () => tableWidth },
      scrollLeft: { writable: true, value: 0 },
    });
    act(() => notifyResize());
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    observe.mockClear();
    vi.unstubAllGlobals();
  });

  function edges() {
    return Array.from(
      host.querySelectorAll<HTMLElement>("[data-scroll-edge]"),
      (el) => el.dataset.scrollEdge,
    );
  }

  it("marks only the edges with hidden columns after scrolling or resizing", () => {
    expect(viewport.tabIndex).toBe(0);
    expect(edges()).toEqual(["right"]);
    act(() => {
      viewport.scrollLeft = 120;
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(edges()).toEqual(["left", "right"]);
    act(() => {
      viewport.scrollLeft = 310;
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(edges()).toEqual(["left"]);
    act(() => {
      clientWidth = 844;
      viewport.scrollLeft = 0;
      notifyResize();
    });
    expect(edges()).toEqual([]);
    expect(viewport.hasAttribute("tabindex")).toBe(false);
    act(() => {
      tableWidth = 880;
      notifyResize();
    });
    expect(edges()).toEqual(["right"]);
  });

  it("handles horizontal arrow keys only when the scroll region has focus", () => {
    const scrollBy = vi.fn();
    viewport.scrollBy = scrollBy;
    const press = (target: HTMLElement, key: string) => {
      target.focus();
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press(viewport, "ArrowRight")).toBe(true);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 96 });
    expect(press(viewport, "ArrowLeft")).toBe(true);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -96 });
    expect(press(viewport.querySelector("input")!, "ArrowRight")).toBe(false);
    expect(press(viewport, "ArrowDown")).toBe(false);
    expect(scrollBy).toHaveBeenCalledTimes(2);
  });
});
