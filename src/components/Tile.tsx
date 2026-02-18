import { twMerge } from 'tailwind-merge';
import { useMemo } from 'react';

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
    animationPreset: 'none' | 'pop' | 'slide' | 'typewriter';
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
    const staggerDelay = 0.05;
    let animStyle: React.CSSProperties = {};
    if (animationPreset !== 'none') {
        const start = index * staggerDelay;
        let t = (animationProgress - start) / 0.3;
        t = Math.max(0, Math.min(1, t));

        const easeOutBack = (x: number): number => {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
        };
        const easeOutQuad = (x: number): number => 1 - (1 - x) * (1 - x);

        if (animationPreset === 'pop') {
            const scaleAnim = easeOutBack(t);
            // We multiply our static scaleMultiplier by the animation scale
            const currentScale = scaleMultiplier * scaleAnim;
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation}deg) scale(${currentScale})`,
                opacity: t < 0.1 ? 0 : 1
            };
        } else if (animationPreset === 'slide') {
            const yAnim = (1 - easeOutQuad(t)) * 100;
            animStyle = {
                transform: `translate(${posOffset.x}px, ${posOffset.y + yAnim}px) rotate(${rotation}deg) scale(${scaleMultiplier})`,
                opacity: t
            };
        } else if (animationPreset === 'typewriter') {
            const visible = t > 0.5;
            animStyle = {
                opacity: visible ? 1 : 0,
                transform: `translate(${posOffset.x}px, ${posOffset.y}px) rotate(${rotation}deg) scale(${scaleMultiplier})`
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
