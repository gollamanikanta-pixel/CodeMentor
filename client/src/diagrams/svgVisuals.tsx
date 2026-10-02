import { useId, type ReactNode } from 'react';

/**
 * Hand-crafted SVG learning visuals.
 *
 * Design language
 * ---------------
 * Every diagram is drawn on the same 480 x 210 canvas and shares one token set,
 * so the whole set reads as a single system rather than seven one-off pictures:
 *
 *   · soft vertical surfaces for structure, cyan-tinted surfaces for the part
 *     being explained right now;
 *   · an indigo → cyan flow gradient for every connection, with a dashed
 *     travelling stroke so "data moving" is visible at a glance;
 *   · Space Grotesk for node labels, JetBrains Mono for indices, depths and
 *     annotations — the same pairing the editor and console use;
 *   · one uppercase annotation line at the foot of each canvas carrying the
 *     actual teaching point.
 *
 * Honesty rule: these diagrams describe *structure*. They never invent runtime
 * values, and every label is either generic (element, key, value) or comes from
 * structure the local analyzer actually detected.
 */

export type SvgVisualProps = { label?: string; values?: string[] };

type Ids = {
  surface: string;
  active: string;
  flow: string;
  shadow: string;
};

function useIds(): Ids {
  const uid = useId().replace(/[:]/g, '');
  return {
    surface: `cm-surface-${uid}`,
    active: `cm-active-${uid}`,
    flow: `cm-flow-${uid}`,
    shadow: `cm-shadow-${uid}`,
  };
}

const MONO = 'JetBrains Mono, ui-monospace, monospace';
const DISPLAY = 'Space Grotesk, DM Sans, sans-serif';

const CANVAS_W = 480;
const CANVAS_H = 210;

/* ------------------------------------------------------------- primitives -- */

function Defs({ ids }: { ids: Ids }) {
  return (
    <defs>
      <linearGradient id={ids.surface} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--surface3)" />
        <stop offset="100%" stopColor="var(--surface2)" />
      </linearGradient>
      <linearGradient id={ids.active} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(85,216,230,.34)" />
        <stop offset="100%" stopColor="rgba(85,216,230,.12)" />
      </linearGradient>
      <linearGradient id={ids.flow} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="var(--indigo)" />
        <stop offset="100%" stopColor="var(--cyan)" />
      </linearGradient>
      <filter id={ids.shadow} x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#02060e" floodOpacity="0.32" />
      </filter>
    </defs>
  );
}

function TinyText({
  x,
  y,
  children,
  fill = 'var(--faint)',
  size = 9.5,
  anchor = 'start',
  weight,
  mono = true,
  letter = 0.8,
  rotate,
}: {
  x: number;
  y: number;
  children: ReactNode;
  fill?: string;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  weight?: number;
  mono?: boolean;
  letter?: number;
  rotate?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      fill={fill}
      textAnchor={anchor}
      letterSpacing={letter}
      fontFamily={mono ? MONO : DISPLAY}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
    >
      {children}
    </text>
  );
}

/** Rounded surface node: structure by default, "current step" when active. */
function Box({
  ids,
  x,
  y,
  w,
  h,
  label,
  sub,
  active = false,
  dashed = false,
  labelSize = 12.5,
  radius = 10,
}: {
  ids: Ids;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  sub?: string;
  active?: boolean;
  dashed?: boolean;
  labelSize?: number;
  radius?: number;
}) {
  return (
    <g filter={`url(#${ids.shadow})`}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={radius}
        fill={`url(#${active ? ids.active : ids.surface})`}
        stroke={active ? 'rgba(85,216,230,.6)' : 'var(--line)'}
        strokeWidth="1"
        strokeDasharray={dashed ? '4 3' : undefined}
      />
      {label ? (
        <text
          x={x + w / 2}
          y={sub ? y + h / 2 - 3 : y + h / 2 + 4}
          textAnchor="middle"
          fontFamily={DISPLAY}
          fontSize={labelSize}
          fontWeight="600"
          fill={active ? 'var(--cyan)' : 'var(--text)'}
        >
          {label}
        </text>
      ) : null}
      {sub ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 12}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize="8.5"
          letterSpacing="0.6"
          fill="var(--faint)"
        >
          {sub.toUpperCase()}
        </text>
      ) : null}
    </g>
  );
}

/** Connection with the shared flow gradient and a travelling dash. */
function Arrow({
  ids,
  from,
  to,
  y,
  animate = true,
  width = 1.8,
}: {
  ids: Ids;
  from: number;
  to: number;
  y: number;
  animate?: boolean;
  width?: number;
}) {
  const forward = to > from;
  const shaftEnd = to - (forward ? 7 : -7);
  const head = `M${to} ${y} L${shaftEnd} ${y - 4} L${shaftEnd} ${y + 4} Z`;
  return (
    <g>
      <line
        x1={from}
        y1={y}
        x2={shaftEnd}
        y2={y}
        stroke={`url(#${ids.flow})`}
        strokeWidth={width}
        strokeLinecap="round"
        className={animate ? 'cm-flow' : undefined}
      />
      <path d={head} fill="var(--cyan)" />
    </g>
  );
}

/** Segmented connector used by brackets, back-edges and merge paths. */
function Route({
  d,
  ids,
  animate = false,
  stroke,
}: {
  d: string;
  ids: Ids;
  animate?: boolean;
  stroke?: string;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke ?? `url(#${ids.flow})`}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={animate ? 'cm-flow' : undefined}
    />
  );
}

/** Small solid arrowhead placed at a point, pointing along (dx, dy). */
function Head({ x, y, dx, dy, fill = 'var(--cyan)' }: { x: number; y: number; dx: number; dy: number; fill?: string }) {
  const len = 7;
  const nx = -dy;
  const ny = dx;
  const tip = `${x},${y}`;
  const a = `${x - dx * len + nx * 3.6},${y - dy * len + ny * 3.6}`;
  const b = `${x - dx * len - nx * 3.6},${y - dy * len - ny * 3.6}`;
  return <polygon points={`${tip} ${a} ${b}`} fill={fill} />;
}

/** Canvas wrapper: shared viewBox, shared defs, shared annotation line. */
function Canvas({
  title,
  annotation,
  ids,
  children,
}: {
  title: string;
  annotation: string;
  ids: Ids;
  children: ReactNode;
}) {
  return (
    <svg
      className="svg-visual"
      role="img"
      aria-label={`${title}. ${annotation}`}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <desc>{annotation}</desc>
      <Defs ids={ids} />
      {children}
      <circle cx="26" cy="193" r="2.4" fill="var(--cyan)" />
      <TinyText x={36} y={196}>
        {annotation.toUpperCase()}
      </TinyText>
    </svg>
  );
}

/* --------------------------------------------------------------- 1. Array -- */

export function ArrayVisual({ values = ['', '', '', '', ''] }: SvgVisualProps) {
  const ids = useIds();
  const count = Math.min(Math.max(values.length || 5, 2), 5);
  const gap = 14;
  const cellW = 70;
  const startX = (CANVAS_W - (count * cellW + (count - 1) * gap)) / 2;
  const top = 58;
  const height = 50;
  const cells = Array.from({ length: count }, (_, index) => values[index] ?? '');

  return (
    <Canvas
      title="Indexed collection"
      annotation="Positions start at 0 — the last valid index is length − 1"
      ids={ids}
    >
      {/* Length brace above the row */}
      <Route ids={ids} d={`M${startX} 46 V40 H${startX + count * cellW + (count - 1) * gap} V46`} stroke="var(--line-strong)" />
      <TinyText x={CANVAS_W / 2} y={31} anchor="middle" fill="var(--muted)">
        LENGTH = {count}
      </TinyText>

      {cells.map((value, index) => {
        const x = startX + index * (cellW + gap);
        const active = index === 0;
        return (
          <g key={`cell-${index}`}>
            <rect
              x={x}
              y={top}
              width={cellW}
              height={height}
              rx={10}
              fill={`url(#${active ? ids.active : ids.surface})`}
              stroke={active ? 'rgba(85,216,230,.6)' : 'var(--line)'}
              filter={`url(#${ids.shadow})`}
            />
            <text
              x={x + cellW / 2}
              y={top + 31}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize="13"
              fontWeight="600"
              fill={active ? 'var(--cyan)' : 'var(--text)'}
            >
              {value || 'item'}
            </text>
            <TinyText x={x + cellW / 2} y={top + height + 20} anchor="middle" fill={active ? 'var(--cyan)' : 'var(--faint)'}>
              [{index}]
            </TinyText>
            {index < count - 1 ? <Arrow ids={ids} from={x + cellW + 2} to={x + cellW + gap - 2} y={top + height / 2} animate={false} /> : null}
          </g>
        );
      })}

      {/* Pointer to the first slot */}
      <Route ids={ids} d={`M${startX + cellW / 2} 138 V156`} stroke="var(--indigo)" />
      <Head x={startX + cellW / 2} y={137} dx={0} dy={-1} />
      <TinyText x={startX + cellW / 2 + 10} y={168} fill="var(--indigo)">
        READING STARTS HERE
      </TinyText>
    </Canvas>
  );
}

/* --------------------------------------------------------------- 2. Stack -- */

export function StackVisual({ values = ['newest', '', ''] }: SvgVisualProps) {
  const ids = useIds();
  const items = Array.from({ length: 3 }, (_, index) => values[index] ?? '');
  const left = 158;
  const width = 172;

  return (
    <Canvas title="Stack" annotation="One opening, one order — last in, first out" ids={ids}>
      {/* Container with an open mouth: three walls, no top edge */}
      <Route
        ids={ids}
        stroke="var(--line-strong)"
        d={[
          `M${left} 54`,
          `V${164 - 12}`,
          `Q${left} 164 ${left + 12} 164`,
          `H${left + width - 12}`,
          `Q${left + width} 164 ${left + width} ${164 - 12}`,
          `V54`,
        ].join(' ')}
      />

      {/* Items: newest on top */}
      {items.map((value, index) => {
        const active = index === 0;
        return (
          <g key={`item-${index}`}>
            <rect
              x={left + 13}
              y={50 + index * 36}
              width={width - 26}
              height={30}
              rx={8}
              fill={`url(#${active ? ids.active : ids.surface})`}
              stroke={active ? 'rgba(85,216,230,.6)' : 'var(--line)'}
              filter={`url(#${ids.shadow})`}
            />
            <TinyText
              x={left + width / 2}
              y={50 + index * 36 + 19}
              anchor="middle"
              size={11}
              mono={false}
              weight={600}
              letter={0}
              fill={active ? 'var(--cyan)' : 'var(--text)'}
            >
              {value || `slot ${index + 1}`}
            </TinyText>
          </g>
        );
      })}

      {/* Push in from the top-right, pop out from the top-left */}
      <Route ids={ids} d={`M${left + width - 34} 12 V38`} />
      <Head x={left + width - 34} y={40} dx={0} dy={1} />
      <TinyText x={left + width - 26} y={20} fill="var(--cyan)">
        PUSH
      </TinyText>

      <Route ids={ids} d={`M${left + 34} 36 V14`} stroke="var(--indigo)" />
      <Head x={left + 34} y={12} dx={0} dy={-1} fill="var(--indigo)" />
      <TinyText x={left + 26} y={20} anchor="end" fill="var(--indigo)">
        POP
      </TinyText>

      {/* Top-of-stack marker */}
      <Route ids={ids} d={`M${left + width + 8} 62 H${left + width + 30}`} stroke="var(--line-strong)" />
      <TinyText x={left + width + 34} y={65} fill="var(--cyan)">
        TOP
      </TinyText>
    </Canvas>
  );
}

/* --------------------------------------------------------------- 3. Queue -- */

export function QueueVisual({ values = ['first', '', '', 'last'] }: SvgVisualProps) {
  const ids = useIds();
  const cells = Array.from({ length: 4 }, (_, index) => values[index] ?? '');
  const cellW = 88;
  const gap = 10;
  const startX = (CANVAS_W - (4 * cellW + 3 * gap)) / 2;
  const top = 62;
  const height = 48;

  return (
    <Canvas title="Queue" annotation="First in, first out — items leave from the front only" ids={ids}>
      <TinyText x={startX + cellW / 2} y={50} anchor="middle" fill="var(--indigo)">
        FRONT
      </TinyText>
      <TinyText x={startX + 3 * (cellW + gap) + cellW / 2} y={50} anchor="middle" fill="var(--cyan)">
        BACK
      </TinyText>

      {cells.map((value, index) => {
        const active = index === 0;
        const x = startX + index * (cellW + gap);
        return (
          <g key={`q-${index}`}>
            <rect
              x={x}
              y={top}
              width={cellW}
              height={height}
              rx={10}
              fill={`url(#${active ? ids.active : ids.surface})`}
              stroke={active ? 'rgba(85,216,230,.6)' : 'var(--line)'}
              filter={`url(#${ids.shadow})`}
            />
            <TinyText
              x={x + cellW / 2}
              y={top + 30}
              anchor="middle"
              size={11}
              mono={false}
              weight={600}
              letter={0}
              fill={active ? 'var(--cyan)' : 'var(--text)'}
            >
              {value || `slot ${index + 1}`}
            </TinyText>
          </g>
        );
      })}

      {/* Exit on the left, entry on the right */}
      <Route ids={ids} d={`M${startX - 4} 86 H26`} stroke="var(--indigo)" />
      <Head x={24} y={86} dx={-1} dy={0} fill="var(--indigo)" />
      <Route ids={ids} d={`M${startX + 4 * cellW + 3 * gap + 4} 86 H454`} />
      <Head x={456} y={86} dx={1} dy={0} />

      <TinyText x={24} y={122} fill="var(--indigo)">
        REMOVED HERE
      </TinyText>
      <TinyText x={456} y={122} anchor="end" fill="var(--cyan)">
        ADDED HERE
      </TinyText>
    </Canvas>
  );
}

/* ---------------------------------------------------------- 4. Dictionary -- */

/**
 * Schematic by default: the rows read `key → value` rather than plausible-looking
 * sample data, so nothing here can be mistaken for content the analyzer found.
 */
export function DictionaryVisual({ pairs: provided = [] }: { pairs?: Array<[string, string]> }) {
  const ids = useIds();
  const pairs: Array<[string, string]> = provided.length
    ? provided.slice(0, 3)
    : [
        ['key', 'value'],
        ['key', 'value'],
        ['key', 'value'],
      ];

  return (
    <Canvas title="Key and value" annotation="Every key is unique and maps to exactly one value" ids={ids}>
      <TinyText x={116} y={30} anchor="middle" fill="var(--indigo)">
        KEY
      </TinyText>
      <TinyText x={204} y={30} anchor="middle" fill="var(--faint)">
        →
      </TinyText>
      <TinyText x={324} y={30} anchor="middle" fill="var(--cyan)">
        VALUE
      </TinyText>

      {pairs.map(([key, value], index) => {
        const y = 40 + index * 38;
        const active = index === 0;
        return (
          <g key={`pair-${index}`}>
            <rect
              x={56}
              y={y}
              width={120}
              height={30}
              rx={8}
              fill={`url(#${active ? ids.active : ids.surface})`}
              stroke={active ? 'rgba(85,216,230,.6)' : 'var(--line)'}
              filter={`url(#${ids.shadow})`}
            />
            <TinyText
              x={116}
              y={y + 20}
              anchor="middle"
              size={11.5}
              fill={active ? 'var(--cyan)' : 'var(--text)'}
              letter={0.2}
            >
              {key}
            </TinyText>

            <rect
              x={224}
              y={y}
              width={200}
              height={30}
              rx={8}
              fill={`url(#${ids.surface})`}
              stroke="var(--line)"
              filter={`url(#${ids.shadow})`}
            />
            <TinyText x={324} y={y + 20} anchor="middle" size={11} fill="var(--muted)" letter={0.2}>
              {value}
            </TinyText>

            <Route ids={ids} d={`M180 ${y + 15} H220`} />
            <Head x={222} y={y + 15} dx={1} dy={0} />
          </g>
        );
      })}
    </Canvas>
  );
}

/* -------------------------------------------------------- 5. Function flow -- */

export function FunctionFlowVisual({ label = 'Function body' }: SvgVisualProps) {
  const ids = useIds();
  const name = label.trim().slice(0, 16) || 'Function body';

  return (
    <Canvas title="Function flow" annotation="One entry point, one returned result" ids={ids}>
      {/* Local scope bracket around the body */}
      <Route ids={ids} d="M172 46 H312" stroke="var(--line-strong)" />
      <TinyText x={242} y={38} anchor="middle" fill="var(--faint)">
        LOCAL SCOPE
      </TinyText>

      <Box ids={ids} x={20} y={72} w={104} h={56} label="Input" sub="parameters" radius={12} />
      <Arrow ids={ids} from={126} to={168} y={100} />

      <Box ids={ids} x={172} y={72} w={140} h={56} label={name} sub="own scope" active radius={12} />
      <Arrow ids={ids} from={314} to={356} y={100} />

      <Box ids={ids} x={356} y={72} w={104} h={56} label="Return" sub="value" radius={12} />

      <TinyText x={242} y={162} anchor="middle" fill="var(--faint)">
        ARGUMENTS IN · SCOPE OPENED · RESULT OUT
      </TinyText>
    </Canvas>
  );
}

/* ---------------------------------------------------------- 6. Recursion -- */

export function RecursionStackVisual({ label = 'call' }: SvgVisualProps) {
  const ids = useIds();
  const frames = [0, 1, 2];
  const name = label.trim().slice(0, 14) || 'call';

  return (
    <Canvas title="Call stack" annotation="Each call waits for the one below it to finish" ids={ids}>
      {frames.map((index) => {
        const isBase = index === frames.length - 1;
        const x = 96 + index * 12;
        const y = 34 + index * 36;
        return (
          <g key={`frame-${index}`}>
            <rect
              x={x}
              y={y}
              width={222}
              height={32}
              rx={9}
              fill={`url(#${isBase ? ids.active : ids.surface})`}
              stroke={isBase ? 'rgba(85,216,230,.6)' : 'var(--line)'}
              filter={`url(#${ids.shadow})`}
            />
            <TinyText x={x + 16} y={y + 20} size={11} mono={false} weight={600} letter={0} fill={isBase ? 'var(--cyan)' : 'var(--text)'}>
              {isBase ? 'base case returns' : `${name} ${index + 1}`}
            </TinyText>
            <TinyText x={x + 206} y={y + 20} anchor="end" fill={isBase ? 'var(--cyan)' : 'var(--faint)'}>
              DEPTH {index + 1}
            </TinyText>
          </g>
        );
      })}

      {/* Unwinding direction */}
      <Route ids={ids} d="M352 142 V36" stroke="var(--indigo)" />
      <Head x={352} y={34} dx={0} dy={-1} fill="var(--indigo)" />
      <TinyText x={374} y={92} rotate={-90} anchor="middle" fill="var(--indigo)">
        RESULTS UNWIND UPWARD
      </TinyText>
    </Canvas>
  );
}

/* ----------------------------------------------------------- 7. Sequence -- */

export function SequenceVisual({ steps = [] }: { steps?: string[] }) {
  const ids = useIds();
  const shown = ['Prepare', 'Process'].map((fallback, index) => (steps[index] ?? fallback).slice(0, 14));

  return (
    <Canvas title="Program flow" annotation="Each step finishes before the next one begins" ids={ids}>
      {/* Terminal shape (pill) marks start and end of the program */}
      <Box ids={ids} x={24} y={78} w={88} h={38} label="Start" radius={19} />
      <Arrow ids={ids} from={114} to={140} y={97} />

      {shown.map((step, index) => {
        const x = 144 + index * 112;
        return (
          <g key={step}>
            <Box ids={ids} x={x} y={78} w={88} h={38} label={step} active={index === 1} />
            <circle cx={x + 44} cy={64} r={9} fill="var(--surface3)" stroke="var(--line)" />
            <TinyText x={x + 44} y={67.5} anchor="middle" fill="var(--indigo)">
              {index + 1}
            </TinyText>
            <Arrow ids={ids} from={x + 90} to={x + 110} y={97} />
          </g>
        );
      })}

      <Box ids={ids} x={368} y={78} w={88} h={38} label="End" radius={19} />
      <TinyText x={68} y={142} anchor="middle" fill="var(--faint)">
        START
      </TinyText>
      <TinyText x={412} y={142} anchor="middle" fill="var(--faint)">
        END
      </TinyText>
      <TinyText x={240} y={168} anchor="middle" fill="var(--faint)">
        SEQUENTIAL — NO BRANCHING DETECTED
      </TinyText>
    </Canvas>
  );
}

/* --------------------------------------------------------------- 8. Loop -- */

export function LoopVisual({ label = 'items' }: SvgVisualProps) {
  const ids = useIds();
  const subject = label.trim().slice(0, 12) || 'items';

  return (
    <Canvas title="Loop" annotation="The body repeats until the condition is false" ids={ids}>
      <Box ids={ids} x={150} y={18} w={180} h={30} label="Prepare counter" labelSize={11} radius={9} />
      <Route ids={ids} d="M240 50 V56" />
      <Head x={240} y={58} dx={0} dy={1} />

      {/* Condition diamond */}
      <polygon
        points="240,58 312,90 240,122 168,90"
        fill={`url(#${ids.active})`}
        stroke="rgba(85,216,230,.6)"
        strokeWidth="1"
        filter={`url(#${ids.shadow})`}
      />
      <text x="240" y="87" textAnchor="middle" fontFamily={DISPLAY} fontSize="11.5" fontWeight="600" fill="var(--cyan)">
        more {subject}?
      </text>
      <text x="240" y="101" textAnchor="middle" fontFamily={MONO} fontSize="8.5" letterSpacing="0.6" fill="var(--faint)">
        CONDITION
      </text>

      {/* Yes → body */}
      <TinyText x={320} y={84} fill="var(--green)">
        YES
      </TinyText>
      <Arrow ids={ids} from={314} to={334} y={90} />
      <Box ids={ids} x={336} y={70} w={124} h={40} label="Loop body" sub="+ update" labelSize={11.5} />

      {/* Back edge into the condition */}
      <Route ids={ids} d="M398 112 V146 H240 V128" animate />
      <Head x={240} y={126} dx={0} dy={-1} />

      {/* No → leave the loop */}
      <TinyText x={150} y={102} anchor="end" fill="var(--amber)">
        NO
      </TinyText>
      <Route ids={ids} d="M166 90 H134 V152" stroke="var(--amber)" />
      <Head x={134} y={154} dx={0} dy={1} fill="var(--amber)" />
      <Box ids={ids} x={86} y={156} w={96} h={28} label="Continue" labelSize={11} radius={14} />
    </Canvas>
  );
}

/* ----------------------------------------------------------- 9. Decision -- */

export function DecisionVisual() {
  const ids = useIds();

  return (
    <Canvas title="Branching logic" annotation="Exactly one branch runs, then both paths rejoin" ids={ids}>
      {/* Condition diamond */}
      <polygon
        points="240,46 332,92 240,138 148,92"
        fill={`url(#${ids.active})`}
        stroke="rgba(85,216,230,.6)"
        strokeWidth="1"
        filter={`url(#${ids.shadow})`}
      />
      <text x="240" y="89" textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="600" fill="var(--cyan)">
        condition?
      </text>
      <text x="240" y="103" textAnchor="middle" fontFamily={MONO} fontSize="8.5" letterSpacing="0.6" fill="var(--faint)">
        TRUE OR FALSE
      </text>

      {/* Yes → right branch */}
      <TinyText x={344} y={86} fill="var(--green)">
        YES
      </TinyText>
      <Arrow ids={ids} from={334} to={354} y={92} />
      <Box ids={ids} x={356} y={72} w={108} h={40} label="True path" labelSize={11.5} />

      {/* No → left branch */}
      <TinyText x={136} y={86} anchor="end" fill="var(--amber)">
        NO
      </TinyText>
      <Arrow ids={ids} from={146} to={126} y={92} />
      <Box ids={ids} x={16} y={72} w={108} h={40} label="False path" labelSize={11.5} />

      {/* Both branches merge back */}
      <Route ids={ids} d="M70 114 V164 H184" />
      <Head x={186} y={164} dx={1} dy={0} />
      <Route ids={ids} d="M410 114 V164 H296" />
      <Head x={294} y={164} dx={-1} dy={0} />
      <Box ids={ids} x={190} y={150} w={100} h={28} label="Continue" labelSize={11} radius={14} />
    </Canvas>
  );
}
