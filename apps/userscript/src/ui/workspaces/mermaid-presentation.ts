// Diagram presentation only: no AI, persistence or workbench state dependencies.
export interface MermaidElement extends HTMLElement {
    _bsbMermaidJob?: {
        code: string;
        idx: number;
        epoch: number;
        repaired: boolean;
        originalCode: string;
        preferredProfileId?: string;
        persisted?: boolean;
    } | null;
    _bsbMermaidPlaceholder?: Comment | null;
    _bsbMermaidHost?: MermaidElement;
}
export function parseMermaidViewBox(svg: Pick<SVGSVGElement, "getAttribute">) {
    const raw = String(svg?.getAttribute("viewBox") || "").trim();
    const [x = 0, y = 0, w = 0, h = 0] = raw.split(/[\s,]+/).map(Number);
    const values = [x, y, w, h];
    if (values.length === 4 && values.every(Number.isFinite) && w > 0 && h > 0) {
        return { x, y, width: w, height: h };
    }
    const width = Number.parseFloat(svg?.getAttribute("width") || "") || 960;
    const height = Number.parseFloat(svg?.getAttribute("height") || "") || 540;
    return { x: 0, y: 0, width, height };
}
export function getMermaidScale(card: HTMLElement) {
    const scale = Number(card?.dataset?.scale);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
export function updateMermaidScaleLabel(card: HTMLElement) {
    const label = card?.querySelector<MermaidElement>(".bsb-mermaid-scale");
    if (label)
        label.textContent = `${Math.round(getMermaidScale(card) * 100)}%`;
}
export function setMermaidScale(card: HTMLElement, scale: number, mode = "manual") {
    if (!card)
        return;
    const stage = card.querySelector<MermaidElement>(".bsb-mermaid-stage");
    if (!stage)
        return;
    const baseWidth = Number(stage.dataset.baseWidth) || 760;
    const next = Math.max(0.35, Math.min(3, Number(scale) || 1));
    card.dataset.scale = String(next);
    card.dataset.fit = mode;
    stage.style.setProperty("--bsb-mermaid-width", `${Math.max(240, Math.round(baseWidth * next))}px`);
    updateMermaidScaleLabel(card);
}
export function fitMermaidToViewport(card: HTMLElement) {
    const viewport = card?.querySelector<MermaidElement>(".bsb-mermaid-viewport");
    const stage = card?.querySelector<MermaidElement>(".bsb-mermaid-stage");
    if (!viewport || !stage)
        return;
    const baseWidth = Number(stage.dataset.baseWidth) || 760;
    const available = Math.max(240, viewport.clientWidth - 36);
    setMermaidScale(card, Math.min(1.5, available / baseWidth), "fit");
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
}
export function buildMermaidCard(svg: SVGSVGElement, idx: number, host: MermaidElement) {
    svg.classList.add("bsb-mermaid-svg");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `架构流程图 ${idx + 1}`);
    const viewBox = parseMermaidViewBox(svg);
    if (!svg.hasAttribute("viewBox"))
        svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    const baseWidth = Math.round(Math.max(760, Math.min(3600, viewBox.width)));
    const card: MermaidElement = document.createElement("section");
    card.className = "bsb-mermaid-card";
    card.dataset.scale = "1";
    card.dataset.fit = "actual";
    const toolbar = document.createElement("div");
    toolbar.className = "bsb-mermaid-toolbar";
    const title = document.createElement("span");
    title.className = "bsb-mermaid-title";
    const repaired = !!host?._bsbMermaidJob?.repaired;
    title.textContent = `架构流程图 ${idx + 1}${repaired ? " · AI 已修复" : ""} · 可滚动查看`;
    const tools = document.createElement("span");
    tools.className = "bsb-mermaid-tools";
    const makeButton = (toolAction: string | undefined, text: string | null, titleText: string) => {
        const toolButton = document.createElement("button");
        toolButton.type = "button";
        toolButton.className = "bsb-mermaid-tool";
        toolButton.dataset.mmdAct = toolAction;
        toolButton.textContent = text;
        toolButton.title = titleText;
        toolButton.setAttribute("aria-label", titleText);
        return toolButton;
    };
    tools.append(makeButton("fit", "适宽", "适应可视区域宽度"), makeButton("actual", "100%", "恢复清晰原始尺寸"), makeButton("zoom-out", "−", "缩小图表"));
    const scaleLabel = document.createElement("span");
    scaleLabel.className = "bsb-mermaid-scale";
    scaleLabel.textContent = "100%";
    tools.append(scaleLabel, makeButton("zoom-in", "+", "放大图表"), makeButton("retry", "重绘", "先重试渲染；若语法失败则只修复该 Mermaid 代码块"), makeButton("fullscreen", "全屏", "全屏查看"));
    toolbar.append(title, tools);
    const viewport = document.createElement("div");
    viewport.className = "bsb-mermaid-viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute("aria-label", "可滚动和缩放的 Mermaid 图表");
    const stage = document.createElement("div");
    stage.className = "bsb-mermaid-stage";
    stage.dataset.baseWidth = String(baseWidth);
    stage.style.setProperty("--bsb-mermaid-width", `${baseWidth}px`);
    stage.appendChild(svg);
    const hint = document.createElement("span");
    hint.className = "bsb-mermaid-hint";
    hint.textContent = "Ctrl + 滚轮缩放";
    viewport.append(stage, hint);
    card.append(toolbar, viewport);
    card._bsbMermaidHost = host || null;
    card._bsbMermaidJob = host?._bsbMermaidJob || null;
    return card;
}
/** The caller owns panel lookup; DOM moves retain the original card and handlers. */
export interface MermaidFullscreenPorts {
    root(): HTMLElement | null;
    requestFrame(callback: () => void): void;
}
export function createMermaidFullscreen(ports: MermaidFullscreenPorts) {
    function closeMermaidFullscreen() {
        const root = ports.root();
        const modal = root?.querySelector<MermaidElement>(".bsb-mermaid-modal");
        if (!modal)
            return;
        const card = modal.querySelector<MermaidElement>(".bsb-mermaid-card");
        const placeholder = card?._bsbMermaidPlaceholder;
        if (card && placeholder?.parentNode) {
            card.classList.remove("is-fullscreen");
            placeholder.replaceWith(card);
            card._bsbMermaidPlaceholder = null;
            const full = card.querySelector<HTMLElement>('[data-mmd-act="fullscreen"]');
            if (full) {
                full.textContent = "全屏";
                full.title = "全屏查看";
            }
        }
        modal.remove();
    }
    function openMermaidFullscreen(card: MermaidElement) {
        if (!card || card.closest(".bsb-mermaid-modal"))
            return;
        closeMermaidFullscreen();
        const root = ports.root();
        if (!root)
            return;
        const placeholder = document.createComment("bsb-mermaid-placeholder");
        card.before(placeholder);
        card._bsbMermaidPlaceholder = placeholder;
        const modal = document.createElement("div");
        modal.className = "bsb-mermaid-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", "Mermaid 图表全屏查看");
        modal.addEventListener("click", (e) => { if (e.target === modal)
            closeMermaidFullscreen(); });
        card.classList.add("is-fullscreen");
        const full = card.querySelector<HTMLElement>('[data-mmd-act="fullscreen"]');
        if (full) {
            full.textContent = "退出";
            full.title = "退出全屏";
        }
        modal.appendChild(card);
        root.appendChild(modal);
        ports.requestFrame(() => fitMermaidToViewport(card));
    }
    return { closeMermaidFullscreen, openMermaidFullscreen };
}
