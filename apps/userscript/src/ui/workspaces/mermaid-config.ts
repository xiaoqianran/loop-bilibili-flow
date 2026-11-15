/** Mermaid configuration belongs to the presentation layer, not the workbench lifecycle. */
export interface MermaidPalette {
  mantle: string;
  surface0: string;
  surface1: string;
  surface2: string;
  base: string;
  rosewater: string;
  blue: string;
  green: string;
  mauve: string;
  subtext1: string;
  yellow: string;
  text: string;
}

/**
 * Both initial rendering and theme switching must use these exact options.
 * In Mermaid 12, htmlLabels is a root option; flowchart.htmlLabels alone
 * leaves text inside foreignObject, which SVG sanitization removes.
 */
export function createMermaidConfig(t: MermaidPalette, darkMode: boolean) {
  return {
    startOnLoad: false,
    theme: "base" as const,
    securityLevel: "strict" as const,
    htmlLabels: false,
    fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    suppressErrorRendering: true,
    deterministicIds: false,
    themeVariables: {
      darkMode,
      background: t.mantle,
      primaryColor: t.surface0,
      primaryTextColor: t.rosewater,
      primaryBorderColor: t.blue,
      secondaryColor: t.surface1,
      secondaryTextColor: t.text,
      secondaryBorderColor: t.green,
      tertiaryColor: t.base,
      tertiaryTextColor: t.text,
      tertiaryBorderColor: t.mauve,
      lineColor: t.subtext1,
      textColor: t.text,
      mainBkg: t.surface0,
      nodeBorder: t.blue,
      clusterBkg: t.base,
      clusterBorder: t.surface2,
      edgeLabelBackground: t.mantle,
      actorBkg: t.surface0,
      actorBorder: t.blue,
      actorTextColor: t.rosewater,
      signalColor: t.subtext1,
      signalTextColor: t.text,
      labelBoxBkgColor: t.surface0,
      labelBoxBorderColor: t.blue,
      labelTextColor: t.rosewater,
      loopTextColor: t.text,
      noteBkgColor: t.surface1,
      noteBorderColor: t.yellow,
      noteTextColor: t.rosewater,
      fontSize: "16px",
    },
    themeCSS: `
          .nodeLabel, .edgeLabel, .label, text { font-size: 16px !important; }
          .edgeLabel rect { fill: ${t.mantle} !important; opacity: .96 !important; }
          .flowchart-link { stroke-width: 2px !important; }
          .marker { fill: ${t.subtext1} !important; stroke: ${t.subtext1} !important; }
          .cluster rect { rx: 10px; ry: 10px; }
        `,
    flowchart: {
      htmlLabels: false,
      useMaxWidth: false,
      curve: "basis" as const,
      nodeSpacing: 48,
      rankSpacing: 64,
      padding: 16,
    },
    sequence: {
      useMaxWidth: false,
      wrap: true,
      diagramMarginX: 32,
      diagramMarginY: 24,
      actorMargin: 72,
      width: 180,
      height: 72,
      boxMargin: 12,
      messageMargin: 42,
    },
  };
}
