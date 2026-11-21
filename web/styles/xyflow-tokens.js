// Map React Flow's own defaults at build time, including its selection rectangle
// and resize handles. The vendor stylesheet continues to own layout and input.
const foreground = "hsl(var(--foreground))";
const border = "hsl(var(--border))";
const surface = "hsl(var(--surface))";
const overrides = new Map([
  ["--xy-resize-background-color-default", foreground],
  ["--xy-selection-background-color-default", "hsl(var(--foreground) / .08)"],
  ["--xy-selection-border-default", "1px dotted hsl(var(--foreground) / .8)"],
  ["--xy-handle-background-color-default", foreground],
  ["--xy-handle-border-color-default", surface],
  ["--xy-node-border-default", `1px solid ${border}`],
  ["--xy-node-boxshadow-selected-default", `0 0 0 1px ${foreground}`],
  ["--xy-node-border-radius-default", "var(--radius-panel)"],
  ["--xy-node-background-color-default", surface],
  ["--xy-background-pattern-dots-color-default", border],
]);

module.exports = () => ({
  postcssPlugin: "mimirq-xyflow-tokens",
  Once(root) {
    root.walkDecls(/^--xy-/, (declaration) => {
      const value = overrides.get(declaration.prop);
      if (value) declaration.value = value;
    });
  },
});
module.exports.postcss = true;
