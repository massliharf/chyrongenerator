import { twMerge } from 'tailwind-merge';
import { useMemo } from 'react';
import type { AnimationPreset } from '../App';

interface TileProps {
    char: string;
    bgColor: string;
    textColor: string;
    chaosLevel: number;
    index: number;
    scale?: number;
    shadowOffset: number;
    shadowChaos: number;
    borderRadius: number;
    padding: number;
    scaleChaos: number;
    posChaos: number;
    fontFamily: string;
    animationProgress: number;
    animationPreset: AnimationPreset;
}

export function Tile({
    char, bgColor, textColor, chaosLevel, index, scale = 1,
    shadowOffset, shadowChaos, borderRadius, padding, scaleChaos, posChaos,
    fontFamily, animationProgress, animationPreset
}: TileProps) {
    // --- Safe Values ---
    const safeChaos = chaosLevel || 0;
    const seed = index * 123.45; // Fixed seed for deterministic randomness

    // --- 1. Rotation Logic (Original: Alternating) ---
    // Was: direction * chaosLevel
    const rotation = useMemo(() => {
        if (safeChaos === 0) return 0;
        const direction = index % 2 === 0 ? -1 : 1;
        return direction * safeChaos;
    }, [safeChaos, index]);

    // --- 2. Position Chaos (Original: X/Y Chatter) ---
    const posOffset = useMemo(() => {
        if (!posChaos || posChaos === 0) return { x: 0, y: 0 };
        const r1 = Math.sin(seed) * posChaos;
        const r2 = Math.cos(seed * 0.5) * posChaos;
        return { x: r1, y: r2 };
    }, [posChaos, seed]);

    // --- 3. Scale Chaos (Original: +/- Variation) ---
    const scaleMultiplier = useMemo(() => {
        if (!scaleChaos || scaleChaos === 0) return 1;
        const r = Math.sin(seed * 2.5); // -1 to 1
        return 1 + (r * scaleChaos);
    }, [scaleChaos, seed]);

    // --- 4. Shadow Chaos (Original: Variance on offset) ---
    const finalShadowOffset = useMemo(() => {
        let offset = shadowOffset;
        if (shadowChaos > 0) {
            const rand = Math.abs(Math.sin(index * 3.3));
            const variance = (rand - 0.5) * 2 * shadowChaos;
            offset = Math.max(0, shadowOffset + variance);
        }
        return offset;
    }, [shadowOffset, shadowChaos, index]);


    // --- Animation Logic ---
    let animStyle: React.CSSProperties = {};
    if (animationPreset !== 'none') {
        // Per-preset stagger and transition window for better feel
        const presetConfig: Record<string, { stagger: number; window: number }> = {
            pop:        { stagger: 0.04,  window: 0.35 },
            slide:      { stagger: 0.025, window: 0.4  },
            typewriter: { stagger: 0.06,  window: 0.15 },
            bounce:     { stagger: 0.035, window: 0.5  },
            flip:       { stagger: 0.045, window: 0.4  },
            wave:       { stagger: 0.025, window: 0.5  },
            elastic:    { stagger: 0.04,  window: 0.45 },
            glitch:     { stagger: 0.03,  window: 0.35 },
            zoom:       { stagger: 0.035, window: 0.4  },
            spin:       { stagger: 0.04,  window: 0.45 },
            cascade:    { stagger: 0.04,  window: 0.45 },
            shutter:    { stagger: 0.035, window: 0.4  },
            swing:      { stagger: 0.045, window: 0.5  },
            drift:      { stagger: 0.03,  window: 0.38 },
            pulse:      { stagger: 0.035, window: 0.45 },
        };
        const cfg = presetConfig[animationPreset] || { stagger: 0.04, window: 0.35 };
        const start = index * cfg.stagger;
        let t = (animationProgress - start) / cfg.window;
        t = Math.max(0, Math.min(1, t));

        // --- Easing functions ---
        const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
        const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);
        const easeOutBack = (x: number): number => {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
        };
        const easeOutBounce = (x: number): number => {
            const n1 = 7.5625;
            const d1 = 2.75;
            if (x < 1 / d1) return n1 * x * x;
            else if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
            else if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
            else return n1 * (x -= 2.625 / d1) * x + 0.984375;
        };
        const easeOutElastic = (x: number): number => {
            if (x === 0 || x === 1) return x;
            const c4 = (2 * Math.PI) / 3;
            return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
        };
        // Smooth opacity fade (no harsh cutoffs)
        const fadeIn = (x: number): number => Math.min(1, x * 5); // 0→1 over first 20%

        if (animationPreset === 'pop') {
            const scaleAnim = easeOutBack(t);
            const currentScale = scaleMultiplier * scaleAnim;
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation}deg) scale(${currentScale})`,
                opacity: fadeIn(t)
            };
        } else if (animationPreset === 'slide') {
            const yAnim = (1 - easeOutCubic(t)) * 80;
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y + yAnim}px) rotate(${rotation}deg) scale(${scaleMultiplier})`,
                opacity: easeOutCubic(t)
            };
        } else if (animationPreset === 'typewriter') {
            const visible = t > 0.5;
            animStyle = {
                opacity: visible ? 1 : 0,
                transform: `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation}deg) scale(${scaleMultiplier})`
            };
        } else if (animationPreset === 'bounce') {
            // Drop from above with bounce settle
            const yAnim = (1 - easeOutBounce(t)) * 120;
            const squash = t > 0.5 ? 1 : 1 + (1 - easeOutBounce(t)) * 0.1;
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y - yAnim}px) rotate(${rotation}deg) scale(${scaleMultiplier * squash})`,
                opacity: fadeIn(t)
            };
        } else if (animationPreset === 'flip') {
            // 3D card-flip reveal with proper perspective
            const flipT = easeOutCubic(t);
            const flipAngle = (1 - flipT) * 90; // 90° → 0° (half-flip, no backface issue)
            const scaleZ = 0.8 + 0.2 * flipT; // slight depth scale
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation}deg) perspective(800px) rotateY(${flipAngle}deg) scale(${scaleMultiplier * scaleZ})`,
                opacity: fadeIn(t)
            };
        } else if (animationPreset === 'wave') {
            // Smooth wave: tiles rise with sinusoidal Y offset and gentle scale
            const wavePhase = index * 0.4; // phase offset per tile
            const waveT = Math.max(0, Math.min(1, (animationProgress - index * 0.02) / 0.55));
            const easedT = easeOutQuart(waveT);
            const waveY = Math.sin(waveT * Math.PI * 2 - wavePhase) * 25 * (1 - easedT);
            const waveScale = scaleMultiplier * (0.3 + 0.7 * easedT);
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y + waveY}px) rotate(${rotation}deg) scale(${waveScale})`,
                opacity: fadeIn(waveT)
            };
        } else if (animationPreset === 'elastic') {
            // Elastic spring-in with overshoot
            const elasticScale = scaleMultiplier * easeOutElastic(t);
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation + (1 - t) * 8 * Math.sin(t * 10)}deg) scale(${elasticScale})`,
                opacity: fadeIn(t)
            };
        } else if (animationPreset === 'glitch') {
            // Multi-layer glitch: X jitter, scale distortion, opacity flicker
            const glitchPhase = seed + animationProgress * 80;
            const jitterX = t < 0.85 ? Math.sin(glitchPhase) * 25 * Math.pow(1 - t, 2) : 0;
            const jitterY = t < 0.85 ? Math.cos(glitchPhase * 1.3) * 8 * Math.pow(1 - t, 2) : 0;
            const scaleGlitch = t < 0.7 ? scaleMultiplier * (1 + Math.sin(glitchPhase * 3) * 0.15 * (1 - t)) : scaleMultiplier;
            const flickerRaw = Math.sin(animationProgress * 300 + index * 13);
            const flicker = t < 0.6 ? (flickerRaw > -0.3 ? 1 : 0.15) : 1;
            animStyle = {
                transform: `translate(${posOffset.x + jitterX}px, ${posOffset.y + jitterY}px) rotate(${rotation}deg) scale(${scaleGlitch})`,
                opacity: t < 0.02 ? 0 : flicker
            };
        } else if (animationPreset === 'zoom') {
            // Dramatic Zoom-in slam with subtle overshoot
            const zoomScale = 2.4 - 1.4 * easeOutCubic(t);
            const yShift = (1 - easeOutCubic(t)) * -30;
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y + yShift}px) rotate(${rotation}deg) scale(${scaleMultiplier * zoomScale})`,
                opacity: fadeIn(t)
            };
        } else if (animationPreset === 'spin') {
            // Whirlwind 360-degree orbital spin into position
            const spinAngle = (1 - easeOutCubic(t)) * 360;
            const spinScale = easeOutBack(t);
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation + spinAngle}deg) scale(${scaleMultiplier * spinScale})`,
                opacity: fadeIn(t)
            };
        } else if (animationPreset === 'cascade') {
            // Staggered waterfall drop with alternating diagonal tilt
            const dir = index % 2 === 0 ? -1 : 1;
            const xShift = (1 - easeOutCubic(t)) * dir * 60;
            const yShift = (1 - easeOutBounce(t)) * -90;
            const tilt = (1 - t) * dir * 20;
            animStyle = {
                transform: `translate(${posOffset.x + xShift}px, ${posOffset.y + yShift}px) rotate(${rotation + tilt}deg) scale(${scaleMultiplier})`,
                opacity: fadeIn(t)
            };
        } else if (animationPreset === 'shutter') {
            // Split-flap departure board 3D Flip (rotateX)
            const flipX = (1 - easeOutCubic(t)) * -90;
            const scaleY = 0.6 + 0.4 * easeOutCubic(t);
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation}deg) perspective(600px) rotateX(${flipX}deg) scale(${scaleMultiplier * scaleY})`,
                opacity: fadeIn(t)
            };
        } else if (animationPreset === 'swing') {
            // Hanging pendulum sign swing
            const swingAngle = Math.sin((1 - t) * Math.PI * 3.5) * 35 * Math.pow(1 - t, 2);
            animStyle = {
                transformOrigin: 'top center',
                transform: `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation + swingAngle}deg) scale(${scaleMultiplier})`,
                opacity: fadeIn(t)
            };
        } else if (animationPreset === 'drift') {
            // High-speed drift with dynamic skew angle
            const driftX = (1 - easeOutCubic(t)) * 130;
            const skewAngle = (1 - easeOutCubic(t)) * -22;
            animStyle = {
                transform: `translate(${posOffset.x + driftX}px, ${posOffset.y}px) skewX(${skewAngle}deg) rotate(${rotation}deg) scale(${scaleMultiplier})`,
                opacity: fadeIn(t)
            };
        } else if (animationPreset === 'pulse') {
            // Shockwave heartbeat pulse
            const pulseScale = t < 0.6
                ? easeOutBack(t / 0.6) * 1.2
                : 1 + Math.sin((t - 0.6) / 0.4 * Math.PI * 2) * 0.15 * Math.pow(1 - t, 1.5);
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation}deg) scale(${scaleMultiplier * pulseScale})`,
                opacity: fadeIn(t)
            };
        }
    }

    // --- Final Composition ---
    // If no animation, we apply the static transform
    const staticTransform = `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation}deg) scale(${scaleMultiplier})`;

    const finalTransform = animationPreset !== 'none' && animStyle.transform
        ? animStyle.transform
        : staticTransform;

    const finalOpacity = animationPreset !== 'none'
        ? animStyle.opacity
        : 1;

    const borderColor = `color-mix(in srgb, ${bgColor}, black 20%)`;

    return (
        <div
            className={twMerge(
                "flex items-center justify-center font-bold shadow-lg transition-colors duration-200 select-none",
            )}
            style={{
                width: `${scale * 4}rem`,
                height: `${scale * 4}rem`,
                fontSize: `${scale * 2.5}rem`,
                backgroundColor: bgColor,
                color: textColor,
                borderRadius: `${borderRadius}px`,
                // Restore the shadow look using the calculated offset
                boxShadow: `${finalShadowOffset}px ${finalShadowOffset}px 0px ${borderColor}`,
                transform: finalTransform,
                opacity: finalOpacity,
                borderBottom: `${Math.max(2, scale * 4)}px solid color-mix(in srgb, ${bgColor}, black 20%)`,
                padding: `${padding}px`,
                fontFamily: fontFamily,
                ...animStyle // Keep this to overwrite anything if needed, though we handled transform explicitly
            }}
        >
            {char.toUpperCase()}
        </div>
    );
}
