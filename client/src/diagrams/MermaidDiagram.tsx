import { useEffect, useId, useState } from 'react';
import { useTheme } from '../settings/SettingsContext';
import { renderMermaidSource } from './renderMermaidSource';

/**
 * Renders a Mermaid flowchart that follows the app theme.
 *
 * Mermaid is loaded lazily and configured with `securityLevel: 'strict'` plus
 * `htmlLabels: false` so no HTML from a label is ever interpreted. The palette
 * is derived from the active theme, and the diagram re-renders when the learner
 * switches between light and dark. Invalid diagrams degrade to an honest
 * fallback message rather than an empty box.
 */
export function MermaidDiagram({ source, title }: { source: string | null; title: string }) {
  const reactId = useId().replace(/[:]/g, '');
  const { resolved } = useTheme();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSvg('');
    if (!source) {
      setFailed(true);
      return;
    }
    (async () => {
      try {
        const rendered = await renderMermaidSource(source, `cm-mermaid-${reactId}`, resolved);
        if (!cancelled) setSvg(rendered);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setSvg('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, reactId, resolved]);

  if (failed || !source) {
    return (
      <p className="mermaid-fallback" role="note">
        A flow diagram could not be generated for this structure. The visual above still describes the program flow.
      </p>
    );
  }

  if (!svg) {
    return (
      <div className="skeleton" aria-hidden="true">
        <span style={{ width: '78%' }} />
        <span style={{ width: '56%' }} />
      </div>
    );
  }

  return (
    <div
      key={resolved}
      className="mermaid-host"
      role="img"
      aria-label={`${title} flow diagram`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
