import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PAGE_TITLE_ICON_NAMES, PageTitleIcon } from "./page-title-icon";

describe("PageTitleIcon", () => {
  it.each(PAGE_TITLE_ICON_NAMES)(
    "renders %s as a scalable monochrome decorative SVG",
    (name) => {
      const svg = renderToStaticMarkup(createElement(PageTitleIcon, { name }));
      expect(svg).toContain("<svg");
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain(`data-page-icon="${name}"`);
      expect(svg).not.toContain("<img");
    },
  );
});
