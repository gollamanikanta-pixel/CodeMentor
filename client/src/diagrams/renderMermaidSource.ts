let initialized = false;

export async function renderMermaidSource(source: string, id: string, theme: 'dark' | 'light'): Promise<string> {
  const mermaid = (await import('mermaid')).default;
  if (!initialized) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    initialized = true;
  }
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: 'DM Sans, sans-serif',
    themeVariables:
      theme === 'dark'
        ? {
            background: 'transparent',
            primaryColor: '#1d2c44',
            primaryTextColor: '#e4ebf8',
            primaryBorderColor: '#3a4f70',
            lineColor: '#55d8e6',
            secondaryColor: '#19273d',
            tertiaryColor: '#141f33',
            noteBkgColor: '#1d2c44',
            noteTextColor: '#dce5f5',
            noteBorderColor: '#3a4f70',
          }
        : {
            background: 'transparent',
            primaryColor: '#ffffff',
            primaryTextColor: '#17243a',
            primaryBorderColor: '#c3d1e2',
            lineColor: '#0f7f8f',
            secondaryColor: '#eef3fa',
            tertiaryColor: '#f4f7fb',
            noteBkgColor: '#ffffff',
            noteTextColor: '#17243a',
            noteBorderColor: '#c3d1e2',
          },
    flowchart: {
      htmlLabels: false,
      curve: 'basis',
      padding: 12,
      nodeSpacing: 42,
      rankSpacing: 46,
      useMaxWidth: true,
    },
  });
  const rendered = await mermaid.render(id, source);
  return rendered.svg;
}
