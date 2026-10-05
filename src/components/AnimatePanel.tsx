import {
  Activity,
  Aperture,
  ArrowDownFromLine,
  ArrowDownToLine,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  ArrowUpFromLine,
  AudioWaveform,
  Bell,
  ChevronsDown,
  Circle,
  Clapperboard,
  Copy,
  Disc3,
  Droplets,
  FlipHorizontal2,
  Focus,
  FoldVertical,
  Hammer,
  Heart,
  HeartPulse,
  Keyboard,
  Lightbulb,
  MoveHorizontal,
  MoveUp,
  MoveVertical,
  Orbit,
  Radar,
  RotateCw,
  ScanLine,
  Scissors,
  Shuffle,
  Sparkle,
  Sparkles,
  Spline,
  Split,
  Stamp,
  Sun,
  Tornado,
  Vibrate,
  Waves,
  Waypoints,
  Wind,
  Zap,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react'
import { Color, Field, NumberField } from './Controls'
import { Chips } from './InspectorParts'
import { useGroups } from './inspectorHooks'
import {
  EASINGS,
  MAX_HOLD,
  PRIMARY_CHYRON,
  effectsFor,
  layerTiming,
  styleOf,
  type ChyronLayer,
  type ChyronStyle,
  type Easing,
  type ElementLayer,
  type Emphasis,
  type HoldEffect,
  type ImageMotion,
  type Layer,
  type Motion,
  type Project,
} from '../studio/model'
import { chyronStylePatch, updateLayer } from '../studio/layers'
import type { TimingChange } from './Timeline'

type Patch = (patch: Partial<Project>) => void
type Preview = (phase: 'intro' | 'outro', returnToRest?: boolean) => void

/* ---------- Catalogs: per-letter styles for text, element styles for images and shapes ---------- */

const LETTER_MOTION: Record<Motion, { name: string; Icon: LucideIcon }> = {
  fade: { name: 'Fade', Icon: Circle },
  pop: { name: 'Pop', Icon: Sparkles },
  slide: { name: 'Rise', Icon: MoveUp },
  none: { name: 'Still', Icon: Clapperboard },
  drop: { name: 'Drop', Icon: ArrowDownToLine },
  bounce: { name: 'Bounce', Icon: ChevronsDown },
  wave: { name: 'Wave', Icon: Waves },
  elastic: { name: 'Elastic', Icon: MoveHorizontal },
  'from-left': { name: 'From left', Icon: ArrowRightFromLine },
  'from-right': { name: 'From right', Icon: ArrowLeftFromLine },
  split: { name: 'Split', Icon: Split },
  scatter: { name: 'Scatter', Icon: Shuffle },
  flip: { name: 'Flip', Icon: FlipHorizontal2 },
  spin: { name: 'Spin', Icon: RotateCw },
  swing: { name: 'Swing', Icon: Bell },
  cascade: { name: 'Cascade', Icon: Tornado },
  zoom: { name: 'Zoom', Icon: ZoomIn },
  stamp: { name: 'Stamp', Icon: Stamp },
  slam: { name: 'Slam', Icon: Hammer },
  shake: { name: 'Shake', Icon: Vibrate },
  wipe: { name: 'Reveal', Icon: ScanLine },
  typewriter: { name: 'Typewriter', Icon: Keyboard },
  blink: { name: 'Blink', Icon: Lightbulb },
  glitch: { name: 'Glitch', Icon: AudioWaveform },
}
const LETTER_GROUPS: { title: string; items: Motion[] }[] = [
  { title: 'Simple', items: ['fade', 'pop', 'slide', 'none'] },
  { title: 'Bouncy', items: ['drop', 'bounce', 'wave', 'elastic'] },
  { title: 'Move', items: ['from-left', 'from-right', 'split', 'scatter'] },
  { title: 'Turn', items: ['flip', 'spin', 'swing', 'cascade'] },
  { title: 'Impact', items: ['zoom', 'stamp', 'slam', 'shake'] },
  { title: 'Reveal', items: ['wipe', 'typewriter', 'blink', 'glitch'] },
]
const ELEMENT_MOTION: Record<ImageMotion, { name: string; out?: string; Icon: LucideIcon }> = {
  fade: { name: 'Fade', Icon: Circle },
  pop: { name: 'Pop', Icon: Sparkles },
  rise: { name: 'Rise', Icon: MoveUp },
  none: { name: 'Cut', Icon: Scissors },
  burst: { name: 'Burst', Icon: Zap },
  slam: { name: 'Slam', Icon: Hammer },
  drop: { name: 'Drop', Icon: ArrowDownToLine },
  swing: { name: 'Swing', Icon: Bell },
  'slide-left': { name: 'From left', out: 'To left', Icon: ArrowRightFromLine },
  'slide-right': { name: 'From right', out: 'To right', Icon: ArrowLeftFromLine },
  zoom: { name: 'Zoom', Icon: ZoomIn },
  spin: { name: 'Spin', Icon: RotateCw },
  wipe: { name: 'Wipe', Icon: ScanLine },
  iris: { name: 'Iris', Icon: Aperture },
  focus: { name: 'Focus', Icon: Focus },
  flip: { name: 'Flip', Icon: FlipHorizontal2 },
  glitch: { name: 'Glitch', Icon: AudioWaveform },
  stretch: { name: 'Stretch', Icon: MoveVertical },
  roll: { name: 'Roll', Icon: Disc3 },
  unfold: { name: 'Unfold', Icon: FoldVertical },
  bounce: { name: 'Bounce', Icon: ChevronsDown },
  'from-top': { name: 'From top', out: 'To top', Icon: ArrowDownFromLine },
  'from-bottom': { name: 'From bottom', out: 'To bottom', Icon: ArrowUpFromLine },
  flicker: { name: 'Flicker', Icon: Lightbulb },
}
const ELEMENT_GROUPS: { title: string; items: ImageMotion[] }[] = [
  { title: 'Simple', items: ['fade', 'pop', 'rise', 'none'] },
  { title: 'Punchy', items: ['burst', 'slam', 'drop', 'bounce'] },
  { title: 'Springy', items: ['swing', 'stretch', 'unfold', 'flip'] },
  { title: 'Move', items: ['slide-left', 'slide-right', 'from-top', 'from-bottom'] },
  { title: 'Turn', items: ['spin', 'roll', 'zoom', 'focus'] },
  { title: 'Reveal', items: ['wipe', 'iris', 'glitch', 'flicker'] },
]
/** One catalog of on-screen effects; each layer kind shows the ones that suit it. */
const EFFECTS: Record<HoldEffect, { name: string; Icon: LucideIcon }> = {
  none: { name: 'None', Icon: Circle },
  pulse: { name: 'Pulse', Icon: Heart },
  float: { name: 'Float', Icon: Waves },
  sway: { name: 'Sway', Icon: Wind },
  kenburns: { name: 'Ken Burns', Icon: ZoomIn },
  shine: { name: 'Shine', Icon: Sun },
  rumble: { name: 'Rumble', Icon: Activity },
  wiggle: { name: 'Wiggle', Icon: Waypoints },
  heartbeat: { name: 'Heartbeat', Icon: HeartPulse },
  orbit: { name: 'Orbit', Icon: Orbit },
  glow: { name: 'Glow', Icon: Sparkle },
  jelly: { name: 'Jelly', Icon: Droplets },
  wave: { name: 'Letter wave', Icon: Spline },
  ripple: { name: 'Ripple', Icon: Radar },
}
const EASING_NAMES: Record<Easing, string> = {
  auto: 'Signature',
  smooth: 'Smooth',
  snappy: 'Snappy',
  bounce: 'Bounce',
  elastic: 'Elastic',
  linear: 'Linear',
}

const round = (n: number) => Math.round(n * 100) / 100
/** "1 s in · 2.4 s hold · 1 s out", as the Timing section summary. */
const timingSummary = (layer: Layer, p: Project) => {
  const t = layerTiming(layer, p)
  return `${t.delay > 0 ? `from ${round(t.delay)} s · ` : ''}${round(t.length)} s in · ${round(t.hold)} s hold · ${round(t.outLength)} s out`
}

/**
 * Starts at · In · Hold · Out for one layer: the same numbers the timeline clip
 * shows. A Hold longer than the clip leaves room for makes the whole clip longer
 * (every layer shares it), up to the composition's maximum hold.
 */
function TimingFields({
  layer,
  project: p,
  onTiming,
  onClipTiming,
}: {
  layer: Layer
  project: Project
  onTiming: (id: string, change: TimingChange) => void
  onClipTiming?: () => void
}) {
  const t = layerTiming(layer, p)
  const free = (used: number) => round(Math.max(0, t.total - used))
  const fits = free(t.delay + t.length + t.outLength)
  return (
    <>
      <div className="pair-fields">
        <NumberField
          label="Starts at"
          value={round(t.delay)}
          min={0}
          max={free(t.length + t.outLength + t.endDelay)}
          step={0.1}
          unit="s"
          onChange={(delay) => onTiming(layer.id, { delay, endDelay: t.endDelay })}
        />
        <NumberField
          label="In"
          value={round(t.length)}
          min={0.2}
          max={Math.min(4, free(t.delay + t.outLength + t.endDelay))}
          step={0.1}
          unit="s"
          onChange={(length) => onTiming(layer.id, { length })}
        />
        <NumberField
          label="Hold"
          value={round(t.hold)}
          min={0}
          max={round(fits + Math.max(0, MAX_HOLD - p.hold))}
          step={0.1}
          unit="s"
          onChange={(hold) =>
            hold <= fits
              ? onTiming(layer.id, {
                  endDelay: round(Math.max(0, fits - hold)),
                  delay: t.delay,
                })
              : // Longer than the clip: the clip grows by the difference.
                onTiming(layer.id, {
                  endDelay: 0,
                  delay: t.delay,
                  clipHold: round(p.hold + hold - fits),
                })
          }
        />
        <NumberField
          label="Out"
          value={round(t.outLength)}
          min={0.2}
          max={free(t.delay + t.length + t.endDelay)}
          step={0.1}
          unit="s"
          onChange={(outLength) => onTiming(layer.id, { outLength, endDelay: t.endDelay })}
        />
      </div>
      <p className="block-note">
        The clip is {round(t.total)} s. A longer Hold here makes the whole clip longer, for every
        layer.
      </p>
      {onClipTiming && (
        <button className="button ghost sm" onClick={onClipTiming}>
          Clip length and frame rate
        </button>
      )}
    </>
  )
}

/** Effect, strength and cycle: the same controls for every layer kind. */
function OnScreen({
  kind,
  value,
  onChange,
}: {
  kind: Layer['kind']
  value: Partial<Emphasis>
  onChange: (values: Partial<Emphasis>) => void
}) {
  const emphasis = value.emphasis ?? 'none'
  return (
    <>
      <Chips
        label="While on screen"
        items={effectsFor(kind).map((id) => ({ id, ...EFFECTS[id] }))}
        value={emphasis}
        onChange={(next) =>
          onChange({
            emphasis: next,
            emphasisStrength: value.emphasisStrength ?? 50,
            emphasisSpeed: value.emphasisSpeed ?? 2,
          })
        }
      />
      {emphasis !== 'none' && (
        <>
          <NumberField
            label="Strength"
            value={value.emphasisStrength ?? 50}
            min={0}
            max={100}
            unit="%"
            onChange={(emphasisStrength) => onChange({ emphasisStrength })}
          />
          {emphasis !== 'kenburns' && (
            <NumberField
              label="Cycle"
              value={value.emphasisSpeed ?? 2}
              min={0.5}
              max={8}
              step={0.1}
              unit="s"
              onChange={(emphasisSpeed) => onChange({ emphasisSpeed })}
            />
          )}
        </>
      )}
      {kind === 'chyron' && (
        <p className="block-note">Letter wave and Ripple move one letter at a time.</p>
      )}
    </>
  )
}
const effectSummary = (value: Partial<Emphasis>) =>
  !value.emphasis || value.emphasis === 'none'
    ? 'None'
    : `${EFFECTS[value.emphasis].name} · ${value.emphasisStrength ?? 50}%`

/**
 * One Animate panel for every layer: In, Out, Timing and While on screen.
 * Text animates letter by letter; images and shapes move as one piece.
 */
export function AnimatePanel({
  layer,
  project: p,
  patch,
  previewPhase,
  onTiming,
  onClipTiming,
}: {
  layer: Layer
  project: Project
  patch: Patch
  previewPhase: Preview
  onTiming: (id: string, change: TimingChange) => void
  /** Show the composition's clip length (Hold) and frame rate. */
  onClipTiming?: () => void
}) {
  return layer.kind === 'chyron' ? (
    <ChyronAnimate {...{ layer, p, patch, previewPhase, onTiming, onClipTiming }} />
  ) : (
    <ElementAnimate {...{ l: layer, p, patch, previewPhase, onTiming, onClipTiming }} />
  )
}

function ChyronAnimate({
  layer,
  p,
  patch,
  previewPhase,
  onTiming,
  onClipTiming,
}: {
  layer: ChyronLayer
  p: Project
  patch: Patch
  previewPhase: Preview
  onTiming: (id: string, change: TimingChange) => void
  onClipTiming?: () => void
}) {
  const group = useGroups()
  const style = styleOf(p, layer)
  const setStyle = (values: Partial<ChyronStyle>) => patch(chyronStylePatch(p, layer.id, values))
  const others = p.layers.filter((l) => l.kind === 'chyron' && l.id !== layer.id).length
  const shareAnimation = () => {
    const motion = { motion: style.motion, outro: style.outro, stagger: style.stagger }
    const emphasis = {
      emphasis: layer.emphasis,
      emphasisStrength: layer.emphasisStrength,
      emphasisSpeed: layer.emphasisSpeed,
    }
    patch({
      ...(layer.id === PRIMARY_CHYRON ? {} : motion),
      layers: p.layers.map((l) =>
        l.kind === 'chyron' && l.id !== layer.id
          ? { ...l, ...emphasis, ...(l.style ? { style: { ...l.style, ...motion } } : {}) }
          : l,
      ),
    })
  }
  return (
    <div className="props-stack animate-stack">
      {group(
        'anim-in',
        'In',
        LETTER_MOTION[style.motion].name,
        LETTER_GROUPS.map((g) => (
          <div key={g.title} className="motion-group">
            <span className="motion-group-title">{g.title}</span>
            <Chips
              label={`${g.title} animations`}
              columns={4}
              items={g.items.map((id) => ({ id, ...LETTER_MOTION[id] }))}
              value={style.motion}
              onChange={(motion) => {
                setStyle({ motion })
                // Picking a style plays it right away.
                if (motion !== 'none') previewPhase('intro', true)
              }}
            />
          </div>
        )),
      )}
      {group(
        'anim-out',
        'Out',
        `${style.outro === 'mirror' ? 'Reverse of In' : LETTER_MOTION[style.outro].name} · stagger ${style.stagger}`,
        <>
          <Field label="Out">
            <select
              value={style.outro}
              onChange={(e) => {
                setStyle({ outro: e.target.value as ChyronStyle['outro'] })
                previewPhase('outro', true)
              }}
            >
              <option value="mirror">Reverse of In</option>
              {LETTER_GROUPS.flatMap((g) => g.items)
                .filter((id) => id !== 'none')
                .map((id) => (
                  <option key={id} value={id}>
                    {LETTER_MOTION[id].name}
                  </option>
                ))}
            </select>
          </Field>
          <NumberField
            label="Stagger"
            value={style.stagger}
            min={0}
            max={0.8}
            step={0.05}
            onChange={(stagger) => setStyle({ stagger })}
          />
          <p className="block-note">
            Choosing a style plays it. Letters follow one another by the stagger.
          </p>
        </>,
      )}
      {group(
        'anim-timing',
        'Timing',
        timingSummary(layer, p),
        <TimingFields layer={layer} project={p} onTiming={onTiming} onClipTiming={onClipTiming} />,
      )}
      {group(
        'anim-onscreen',
        'While on screen',
        effectSummary(layer),
        <OnScreen
          kind="chyron"
          value={layer}
          onChange={(values) => patch({ layers: updateLayer(p, layer.id, values) })}
        />,
      )}
      {others > 0 && (
        <button
          className="button secondary full"
          title="Give every other chyron and text layer this in, out, stagger and on-screen effect"
          onClick={shareAnimation}
        >
          <Copy size={16} /> Use this animation on {others} other text layer
          {others === 1 ? '' : 's'}
        </button>
      )}
    </div>
  )
}

function ElementAnimate({
  l,
  p,
  patch,
  previewPhase,
  onTiming,
  onClipTiming,
}: {
  l: ElementLayer
  p: Project
  patch: Patch
  previewPhase: Preview
  onTiming: (id: string, change: TimingChange) => void
  onClipTiming?: () => void
}) {
  const group = useGroups()
  const set = (values: Partial<ElementLayer>) => patch({ layers: updateLayer(p, l.id, values) })
  const peers = p.layers.filter(
    (layer) => (layer.kind === 'image' || layer.kind === 'shape') && layer.id !== l.id,
  )
  const others = peers.length
  const kinds = new Set(peers.map((layer) => layer.kind))
  const noun = kinds.size > 1 ? 'layer' : kinds.has('shape') ? 'shape' : 'image'
  return (
    <div className="props-stack animate-stack">
      {group(
        'anim-in',
        'In',
        ELEMENT_MOTION[l.intro].name,
        ELEMENT_GROUPS.map((g) => (
          <div key={g.title} className="motion-group">
            <span className="motion-group-title">{g.title}</span>
            <Chips
              label={`${g.title} intro styles`}
              columns={4}
              items={g.items.map((id) => ({ id, ...ELEMENT_MOTION[id] }))}
              value={l.intro}
              onChange={(intro) => {
                set({ intro })
                previewPhase('intro', true)
              }}
            />
          </div>
        )),
      )}
      {group(
        'anim-out',
        'Out',
        `${l.outro === 'mirror' ? 'Reverse' : (ELEMENT_MOTION[l.outro].out ?? ELEMENT_MOTION[l.outro].name)} · ${EASING_NAMES[l.easing]}`,
        <>
          <div className="pair-fields">
            <Field label="Out">
              <select
                value={l.outro}
                onChange={(e) => {
                  set({ outro: e.target.value as ElementLayer['outro'] })
                  previewPhase('outro', true)
                }}
              >
                <option value="mirror">Reverse</option>
                {ELEMENT_GROUPS.flatMap((g) => g.items).map((id) => (
                  <option key={id} value={id}>
                    {ELEMENT_MOTION[id].out ?? ELEMENT_MOTION[id].name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Easing">
              <select value={l.easing} onChange={(e) => set({ easing: e.target.value as Easing })}>
                {EASINGS.map((id) => (
                  <option key={id} value={id}>
                    {EASING_NAMES[id]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {(l.intro === 'burst' || l.outro === 'burst') && (
            <Color
              label="Burst sparks"
              value={l.burstColor}
              onChange={(burstColor) => set({ burstColor })}
            />
          )}
        </>,
      )}
      {group(
        'anim-timing',
        'Timing',
        timingSummary(l, p),
        <TimingFields layer={l} project={p} onTiming={onTiming} onClipTiming={onClipTiming} />,
      )}
      {group(
        'anim-onscreen',
        'While on screen',
        effectSummary(l),
        <OnScreen kind={l.kind} value={l} onChange={set} />,
      )}
      {others > 0 && (
        <button
          className="button secondary full"
          title="Give every image and shape this intro, outro, easing, length and on-screen effect"
          onClick={() =>
            patch({
              layers: p.layers.map((layer) =>
                (layer.kind === 'image' || layer.kind === 'shape') && layer.id !== l.id
                  ? {
                      ...layer,
                      intro: l.intro,
                      outro: l.outro,
                      easing: l.easing,
                      duration: l.duration,
                      // Ken Burns only moves pictures; shapes keep their own effect.
                      ...(layer.kind === 'shape' && !effectsFor('shape').includes(l.emphasis)
                        ? {}
                        : { emphasis: l.emphasis }),
                      emphasisStrength: l.emphasisStrength,
                      emphasisSpeed: l.emphasisSpeed,
                      burstColor: l.burstColor,
                    }
                  : layer,
              ),
            })
          }
        >
          <Copy size={16} /> Use this animation on {others} other {noun}
          {others === 1 ? '' : 's'}
        </button>
      )}
    </div>
  )
}
