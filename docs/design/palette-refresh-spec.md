# 前端配色与文字清晰度改造规格（Graphite + Signal Blue）

本文档是本次改造的**唯一权威依据**。数值即结论，不要自行"优化"取色或阈值。
仓库：`~/mimirq-ui-engineering-refresh`，分支 `feat/ui-engineering-refresh`（当前线上容器即由此分支构建）。

---

## 0. 用户提出的两个问题

1. **字体发虚、发灰**：主内容文字边缘模糊、有毛边和晕染；深色标题轮廓不锐利；辅助说明文字与白底对比度不足。
2. **配色过淡、无标识区分**：全站灰阶，层级几乎不可见，长时间阅读疲劳。

这两条都不是审美偏好问题，而是可以量化定位的实现缺陷。已核实的证据见下节；改造必须同时消除根因，而不是只调色号。

---

## 1. 已核实的根因（不要再重复调研，直接改）

### 1.1 整页被强制合成层（最主要原因）

`web/components/page-transition.tsx` 用 framer-motion 动画 `filter: blur(5px) → blur(0px)`，动画结束后**把 `filter: blur(0px)` 永久留成内联样式**在包裹全部页面内容的容器上。线上 DOM 实测：

```
FILTER blur(0px) <DIV> flex-1 w-full h-full
```

只要元素带 `filter`（`blur(0px)` 也算，不等于 `none`），Chrome 就会把该子树提升为独立合成层，并**关闭次像素（LCD/ClearType）文字渲染**，改为灰度抗锯齿 + 分层栅格化。于是整页正文统一发虚、发灰、边缘带毛边。这与用户描述完全一致。

### 1.2 全局 `antialiased`

`web/app/globals.css` 的 `body` 上 `@apply ... antialiased`，实测 `getComputedStyle(document.body).webkitFontSmoothing === "antialiased"`。在 Windows 上这会关闭 ClearType 次像素渲染，中文笔画变细、发灰。另有 24 处组件级 `antialiased` 类（集中在 `components/chunk-preview/components/workbench/`）。

### 1.3 弹窗/浮层被钉在半像素上

`web/components/ui/alert-dialog.tsx`、`dialog.tsx` 用 `fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]` 居中：容器宽/高为奇数时，平移量落在半像素上，整层按亚像素偏移栅格化 → 弹窗内所有文字发软。同时永久带 `will-change-[opacity,transform]`（`dropdown-menu.tsx`、`popover.tsx`、`select.tsx` 还额外有 `transform-gpu`），浮层长期保留合成层，同样失去次像素渲染。这正是"删除该文件"弹窗里标题和按钮文字不干脆的直接原因。

### 1.4 表面层级差≈0

浅色主题实测（WCAG 相对亮度比）：

| 组合 | 现测 | 结论 |
|---|---|---|
| `--surface` 98.5% / `--background` 100% | **1.04:1** | 面板与画布几乎不可分 |
| `--border` 89% / 白底 | **1.30:1** | 细线基本看不见 |
| `--subtle-foreground` 48% / 白底 | **4.34:1** | 不达 AA 4.5 |

### 1.5 文字透明度层层削弱

全仓 `text-muted-foreground/NN` 共 468 处、`text-foreground/NN` 共 415 处。叠白色底后的实际观感：

| 写法 | 有效色 | 实际对比度 |
|---|---|---|
| `text-muted-foreground/85` | #757a85 | 4.29:1 |
| `text-muted-foreground/70` | #8d929a | **3.13:1** |
| `text-muted-foreground/60` | #9ea1a9 | **2.58:1** |
| `text-muted-foreground/50` | #aeb1b7 | **2.15:1** |

这就是"辅助说明文字发灰、对比度不足"的来源。

### 1.6 色相被整体抹平

`globals.css` 顶部的 `@theme` 把 21 个 Tailwind 调色板（red/orange/amber/yellow/lime/green/emerald/teal/cyan/sky/blue/indigo/violet/purple/fuchsia/pink/rose/slate/gray/zinc/neutral/stone）全部重映射到 `--mono-*` 灰阶；`--info` = 前景黑；`--teal/--orange/--rose/--indigo` 全部中性化；图表 8 色是纯灰阶。`text-accent` 仍被 68 处当作"第二语义色"使用，但 `--accent` 等于白色/近黑，等于失效。这是"没有明显的标识区分"的来源。

---

## 2. 改造范围

| 编号 | 内容 | 性质 |
|---|---|---|
| A | 渲染层修复：去掉强制合成、去掉 `antialiased`、弹窗改整数像素居中、浮层去常驻 `will-change` | 缺陷修复 |
| B | 新配色：Graphite 中性底 + Signal Blue 主色 + 真实状态色与图表色 | 设计变更 |
| C | 文本对比度扫除：低透明度文本类统一收敛到实心 token | 设计变更 |
| D | 校验：守卫脚本、源码契约测试、构建与视觉验收 | 必须 |

**不动**：布局与间距体系、圆角体系（控件 4px / 面板 6px）、字号行高阶梯、图标、API/查询逻辑、i18n 文案、权限。

---

## 3. A：渲染层修复（逐条必做）

### A1 `web/app/globals.css` body

```css
body {
  @apply bg-background text-foreground selection:bg-primary/20 selection:text-foreground;
  /* 不再设置任何 *-font-smoothing：macOS/Windows 各自使用系统默认（次像素）渲染 */
  font-feature-settings: "rlig" 1, "calt" 1;
  font-synthesis-weight: none;
  line-height: 1.55;
}
```

要点：
- 删除 `antialiased` 类。
- 不要用 `-webkit-font-smoothing: auto` 之类"显式恢复"，保持不设置即可；同时**不要**全局加 `text-rendering: optimizeLegibility`。
- 删除 `font-feature-settings` 里的 `"ss01" 1`（Inter 的 ss01 会改字形，回退到中文字体时无意义，且易造成字形不一致）。
- `font-synthesis-weight: none` 保留（防止合成粗体发糊）。但要确认所有标题使用的字重在其回退字体中真实存在（600/700 均可匹配到 YaHei Bold / PingFang Semibold），不要改成 500 之类无对应字面的值。

### A2 清除组件级 `antialiased`

删除 `components/` 与 `app/` 下全部 `antialiased` 类（当前 24 处，主要在 `components/chunk-preview/components/workbench/sidebar-client.tsx`、`top-bar.tsx`）。其他 `backdrop-blur` 旁边的 `antialiased` 一并删除。

### A3 `web/components/page-transition.tsx`

改为不使用 `filter` 动画：

```tsx
initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
```

动画结束后 DOM 上**不允许残留 `filter` 或非 `none` 的 `transform`**。实现完成后用浏览器 `getComputedStyle` 自检：任何覆盖主内容区的祖先元素都不得出现 `filter != none`。

### A4 弹窗整数像素居中

`components/ui/alert-dialog.tsx`、`components/ui/dialog.tsx`：删除 `left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]` 与 `will-change-[opacity,transform]`。改用占位容器居中：

```tsx
<XDialogPortal>
  <XDialogOverlay />
  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
    <XDialogPrimitive.Content className="relative grid w-full max-w-md gap-4 border border-border bg-popover p-6 text-popover-foreground shadow-strong ...动画类保留..." />
  </div>
</XDialogPortal>
```

- 保留 Radix 的焦点管理与原有进入/退出动画（`animate-in`/`zoom-in-[0.97]` 等）；动画期间允许有 `transform`，静止后不得残留。
- 长内容时 `overflow-y-auto` 需保证弹窗可完整滚动（现有 `max-h` 逻辑不变）。
- 确认 `aria-describedby`、Esc 关闭、遮罩点击关闭行为不变。

### A5 浮层去常驻 `will-change`

`components/ui/dropdown-menu.tsx`、`popover.tsx`、`select.tsx`：删除 `will-change-[opacity,transform]` 与 `transform-gpu`。动画类保留。

### A6 `backdrop-blur` 收敛

规则：**只有覆盖全屏的遮罩层、命令面板这类真正需要景深的地方保留 `backdrop-blur`**；凡是"半透明底 + 背景模糊 + 上面还有文字"的小面积控件，一律改为不透明 `bg-card` / `bg-popover` 并去掉模糊。典型必改：

- `components/document-library/folder-tree.tsx` 文件行悬停工具条（`bg-card/70 ... backdrop-blur`）
- `components/ingestion/bulk-action-bar.tsx`、`components/graph/*`、`components/chunk-preview/**`、`components/parsing/*`、`components/governance-profiles/profile-editor-drawer.tsx`、`components/chat/*` 中的 `backdrop-blur`
- `globals.css` 的 `.glass` / `.glass-card` 工具类：改为不透明 surface，不含 `backdrop-blur`

判断标准：文字落在模糊层上 = 必须改。

### A7 不要引入的措施

不改光标/动画体系，不引入 `next/font` 或任何新字体文件，不新增依赖。

---

## 4. B：新配色（Graphite + Signal Blue）

设计意图：中性底保留工程感，靠**四层表面明度差 + 可见细线**建立层级；**Signal Blue** 承担主操作与当前状态；**Violet** 承担第二语义（AI/向量/分类标签）；状态色真实可辨；图表恢复真实色相。

### B1 `web/app/globals.css` 的 `:root`（浅色，逐值替换）

```css
--background: 220 18% 95.5%;        /* 画布：冷灰，不再纯白 */
--surface: 0 0% 100%;               /* 面板/卡片：纯白 */
--raised: 0 0% 100%;                /* 浮层/选中面 */
--sunken: 220 15% 92.5%;            /* 井：输入框底、表头、代码块 */
--card: 0 0% 100%;
--card-foreground: 222 32% 11%;
--popover: 0 0% 100%;
--popover-foreground: 222 32% 11%;
--border: 220 14% 84%;
--border-strong: 220 12% 68%;
--foreground: 222 32% 11%;
--muted-foreground: 220 12% 34%;
--subtle-foreground: 220 10% 44%;

--primary: 221 84% 45%;             /* Signal Blue */
--primary-foreground: 0 0% 100%;
--primary-hover: 221 84% 40%;
--primary-pressed: 221 84% 38%;
--ink: 222 24% 11%;                 /* 中性强调（近黑按钮），与 primary 解耦 */
--ink-foreground: 0 0% 100%;

--accent: 262 68% 50%;              /* Violet：第二语义 */
--accent-foreground: 0 0% 100%;
--accent-soft: 262 70% 96%;
--selected: 221 88% 95.5%;          /* 当前项底色（蓝调浅底） */

--success: 158 78% 26%;
--success-foreground: 0 0% 100%;
--warning: 32 92% 44%;
--warning-foreground: 30 60% 12%;
--danger: 0 72% 44%;
--danger-foreground: 0 0% 100%;
--destructive: 0 72% 44%;
--destructive-foreground: 0 0% 100%;
--info: 221 84% 45%;
--info-foreground: 0 0% 100%;

--ring: 221 84% 45%;
--focus: 221 84% 45%;
--line: 220 14% 84%;
--input: 220 14% 84%;
--control: 220 12% 68%;
--code-background: 220 15% 94%;
--sidebar-background: 220 17% 92.5%;
--sidebar-foreground: 222 32% 11%;
--sidebar-border: 220 14% 84%;

--secondary: 220 15% 92.5%;
--secondary-foreground: 222 32% 11%;
--muted: 220 15% 92.5%;
--accent-foreground: 0 0% 100%;

--chart-1: 221 84% 42%;
--chart-2: 174 80% 26%;
--chart-3: 262 68% 52%;
--chart-4: 28 88% 42%;
--chart-5: 152 62% 30%;
--chart-6: 344 72% 46%;
--chart-7: 245 64% 56%;
--chart-8: 192 85% 30%;
```

`--shadow-*`、`--radius-*`、`--space-*`、`--app-*` 保持不变。

### B2 `html.dark`（深色，逐值替换）

```css
--background: 222 30% 7%;
--surface: 222 22% 12.5%;
--raised: 222 20% 16%;
--sunken: 222 30% 5%;
--card: 222 22% 12.5%;
--card-foreground: 220 24% 97%;
--popover: 222 20% 16%;
--popover-foreground: 220 24% 97%;
--border: 220 14% 23%;
--border-strong: 220 12% 36%;
--foreground: 220 24% 97%;
--muted-foreground: 220 14% 70%;
--subtle-foreground: 220 12% 58%;

--primary: 219 92% 64%;
--primary-foreground: 222 45% 9%;
--primary-hover: 219 92% 68%;
--primary-pressed: 219 92% 56%;
--ink: 220 16% 96%;
--ink-foreground: 222 30% 7%;

--accent: 262 85% 72%;
--accent-foreground: 262 60% 10%;
--accent-soft: 262 50% 19%;
--selected: 219 60% 19%;

--success: 158 68% 46%;
--success-foreground: 222 45% 9%;
--warning: 38 95% 58%;
--warning-foreground: 222 45% 9%;
--danger: 0 80% 62%;
--danger-foreground: 222 45% 9%;
--destructive: 0 80% 62%;
--destructive-foreground: 222 45% 9%;
--info: 219 92% 64%;
--info-foreground: 222 45% 9%;

--ring: 219 92% 64%;
--focus: 219 92% 64%;
--line: 220 14% 23%;
--input: 220 14% 23%;
--control: 220 12% 36%;
--code-background: 222 30% 9%;
--sidebar-background: 222 28% 5%;
--sidebar-foreground: 220 24% 97%;
--sidebar-border: 220 14% 23%;

--secondary: 222 20% 16%;
--secondary-foreground: 220 24% 97%;
--muted: 222 20% 16%;

--chart-1: 215 92% 66%;
--chart-2: 172 62% 52%;
--chart-3: 262 78% 72%;
--chart-4: 38 92% 62%;
--chart-5: 152 55% 55%;
--chart-6: 345 82% 68%;
--chart-7: 245 78% 76%;
--chart-8: 190 82% 56%;
```

### B3 必须达到的对比度（改造后自检，全部为实测下限）

| 组合 | 下限 |
|---|---|
| `--surface` / `--background` | ≥ 1.10 |
| `--sidebar-background` / `--background`（深色）或 / `--surface`（浅色） | ≥ 1.10 |
| `--border` / 面板底 | ≥ 1.40 |
| `--border-strong` / 面板底 | ≥ 2.00 |
| `--foreground` / `--background` | ≥ 7.0 |
| `--muted-foreground` / `--background` | ≥ 6.0 |
| `--subtle-foreground` / `--background` | ≥ 4.5 |
| `--primary` ↔ `--primary-foreground` | ≥ 4.5 |
| `--success`/`--warning`/`--danger` ↔ 各自 foreground | ≥ 4.5 |
| 每个 `--chart-N` / `--background` | ≥ 3.0 |

### B4 删除调色板灰阶重映射

删除 `globals.css` 顶部 `@theme` 里从 `--color-red-50` 到 `--color-stone-950` 的全部重映射块（21 个色族），以及随之失效的 `--mono-50`…`--mono-950` 定义。

删除后必须清理遗留的原始调色板工具类（当前 23 处，如 `components/parsing/parsing-page-utils.ts` 的 `dark:text-emerald-300`），改用语义 token（`text-success` 等）。执行后全仓不得再出现 Tailwind 原始调色板类：

```bash
grep -rEo '\b(bg|text|border|ring|from|to|via|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b' web/components web/app | wc -l   # 必须为 0
```

### B5 `tailwind.config.ts`

- 暴露新增 token：`sunken`、`accent-soft`、`primary-hover`、`primary-pressed`（若缺失）、`selected`（已存在，确认指向 `--selected`）。
- 保留 `subtle-foreground`、`border-strong`、`control`、`line`、`ink`。
- 不删除任何现有 token 名（避免大面积改动），只新增。

### B6 `web/lib/theme-surface.ts`

- `SurfaceThemeKey` 由 `"mono"` 改为 `"graphite"`，`DEFAULT_SURFACE_THEME = "graphite"`，同步更新 `lib/theme-surface.test.ts` 的断言。
- `html` 的 `data-surface-theme` 值随之变化；`globals.css` 中 5 个 archive 选择器（`neutral/deepsea/classic/earth/ocean`）保留原样（`scripts/check-theme-contrast.mjs` 依赖这些选择器存在）。
- 清理函数、cookie 名不变。

### B7 使用规则（组件层）

- 主操作按钮、当前导航项、焦点环、选中行、可点数字 = `primary` / `selected`。
- 第二语义（AI、向量、检索、分类标签、布尔类型标记）= `accent`。
- 成功/警告/危险 = `success`/`warning`/`danger`，必须同时有文字说明，不得只靠颜色。
- 中性强调按钮（原近黑按钮）改用 `ink` / `ink-foreground`。
- 图表全部改用 `chart-1..8`；同一图表内不得只用灰阶区分系列。
- 表格表头、代码块、输入框底用 `sunken`；卡片/面板用 `card`；浮层用 `popover`/`raised`。

### B8 `DESIGN_MEMORY.md`

替换"黑白主题与交互"一节中关于"彩色只表达三种状态""图表用灰阶""主按钮使用前景反色"的表述，改为本次体系（四层表面、Signal Blue 主色、Violet 第二语义、真实状态色与图表色），并写入对比度下限与"禁止 `text-*-foreground/NN` 低透明度"的约定。

---

## 5. C：文本对比度扫除

新 token 下，`text-muted-foreground/80` 约 4.6:1（勉强），`/70` 约 3.6:1（不达标）。因此按下表**机械替换**，只改 `text-*` 类，不动 `bg-*` / `border-*` / `ring-*` 的透明度写法：

| 原写法 | 改为 |
|---|---|
| `text-muted-foreground/75`…`/99` | `text-muted-foreground` |
| `text-muted-foreground/01`…`/74` | `text-subtle-foreground` |
| `text-foreground/61`…`/99` | `text-foreground`（≥81）或 `text-muted-foreground`（61–80） |
| `text-foreground/01`…`/60` | `text-subtle-foreground` |
| `placeholder:text-muted-foreground/NN` | `placeholder:text-subtle-foreground` |
| `placeholder:text-foreground/NN` | `placeholder:text-subtle-foreground` |

同样适用于带前缀变体：`hover:`、`focus:`、`group-hover:`、`group-focus-within:`、`peer-*`、`aria-*`、`data-[state=...]:`、`dark:` 等，前缀保留。

约束：
- 源码契约测试（`*.source.test.ts`、`*.test.tsx`，全仓约 57 处引用这些类名）必须同步更新，使其与新类名一致；不得为了让测试通过而放宽断言。
- 允许保留低透明度的地方：`disabled:` 变体、纯装饰性图标（`aria-hidden` 且不小于 20px）、遮罩/装饰。遇到这类需要保留的，用注释说明原因。
- 替换用脚本完成，禁止手工逐条改；替换后 `git diff` 必须只包含类名变化。

---

## 6. D：校验与验收

### D1 守卫脚本

- `web/scripts/check-theme-contrast.mjs`：把 §B3 的对比度下限写进 `CHECKS`（新增 `surface-vs-background`、`border-vs-surface`、`border-strong-vs-surface`、`subtle-foreground`、`muted-foreground-on-background` 等条目），阈值按表内数值。脚本必须通过。
- `check-design-tokens.mjs`：如果它现在还强制"无彩色"，把这层规则改成强制"使用语义 token、禁止原始调色板类"。
- 其余 ui-check 子脚本不得因为本次改造失效。

### D2 必须全绿的命令

```bash
cd web
pnpm run lint
pnpm run typecheck
pnpm run ui-check
pnpm run test
node scripts/check-theme-contrast.mjs
pnpm run build      # 构建请用下面带内存上限的方式
```

构建（本机 background 任务受 cgroup 3GB 限制，直接 `pnpm build` 会被 OOM 杀掉）：

```bash
systemd-run --user --wait --collect --slice=ccwork.slice \
  -p MemoryMax=10G -p WorkingDirectory=/home/raphael/mimirq-ui-engineering-refresh/web \
  /bin/bash -lc 'pnpm run build'
```

### D3 视觉自检（实现方必须自己截图看过再交付）

至少覆盖：`/`（对话）、`/knowledge`、`/parsing`、`/datasets/[id]/profile`（图表）、文档库删除确认弹窗、命令面板，浅色与深色各一轮，宽 1600×900 与 1024×768 两档。检查项：

1. 面板与画布能看出一层差；细线可见但不喧宾夺主。
2. 主按钮、当前导航项、焦点环为 Signal Blue；分类标签/AI 标识为 Violet。
3. 图表不再全灰。
4. 弹窗内文字与页面正文字体观感一致、边缘锐利。
5. 任意页面 DOM 内不存在 `filter != none` 的内容包裹层。

### D4 交付物

- 一个 commit，message 用 `feat(web): graphite surfaces with signal-blue accent and crisp text rendering`，正文分 A/B/C/D 四段说明。
- 不要 push，不要改 `main` 分支。

---

## 7. 需要停下来问的情况

- 某处低透明度文本是有意为之（例如禁用态），且替换会破坏可读性判断规则 → 先按规则替换并在 commit 汇报里列出保留项，不要擅自扩大例外。
- 出现与本文档数值冲突的既有测试 → 以本文档为准更新测试，并在汇报里列出改动清单。
- 任何需要改动 API、数据结构、路由的情况 → 停下来报告，不要自行决定。
