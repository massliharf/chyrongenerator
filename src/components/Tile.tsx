import { useMemo } from 'react';
import { twMerge } from 'tailwind-merge';

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
}

export function Tile({
    char, bgColor, textColor, chaosLevel, index, scale = 1,
    shadowOffset, shadowChaos, borderRadius, padding, scaleChaos, posChaos,
    fontFamily
}: TileProps) {
    // Determine random seed based on index
    const seed = index * 123.45;

    // Calculate rotation
    const rotation = useMemo(() => {
        if (chaosLevel === 0) return 0;
        const direction = index % 2 === 0 ? -1 : 1;
        return direction * chaosLevel;
    }, [chaosLevel, index]);

    // Calculate random position offset (X/Y Chatter)
    const positionStyle = useMemo(() => {
        if (!posChaos || posChaos === 0) return { x: 0, y: 0 };
        const r1 = Math.sin(seed) * posChaos;
        const r2 = Math.cos(seed * 0.5) * posChaos;
        return { x: r1, y: r2 };
    }, [posChaos, seed]);

    // Calculate random scale variation
    const scaleMultiplier = useMemo(() => {
        if (!scaleChaos || scaleChaos === 0) return 1;
        const r = Math.sin(seed * 2.5); // -1 to 1
        // scaleChaos 0.1 means +/- 10%
        return 1 + (r * scaleChaos);
    }, [scaleChaos, seed]);

    // Calculate shadow randomization
    const shadowStyle = useMemo(() => {
        let finalOffset = shadowOffset;
        if (shadowChaos > 0) {
            const rand = Math.abs(Math.sin(seed * 3.3)); // 0-1 pseudo random
            const variance = (rand - 0.5) * 2 * shadowChaos;
            finalOffset = Math.max(0, shadowOffset + variance);
        }

        const borderColor = `color-mix(in srgb, ${bgColor}, black 20%)`;
        return {
            boxShadow: `0px ${finalOffset}px 0px ${borderColor}`,
            marginBottom: `${finalOffset}px`
        };
    }, [shadowOffset, shadowChaos, bgColor, seed]);

    return (
        <div
            className={twMerge(
                "relative flex items-center justify-center font-bold select-none",
                "min-w-16 min-h-16 md:min-w-20 md:min-h-20",
                "transition-transform duration-200 ease-out"
            )}
            style={{
                backgroundColor: bgColor,
                color: textColor,
                fontFamily: fontFamily,
                borderRadius: `${borderRadius}px`,
                padding: `${padding}px`,
                transform: `
                    translate(${positionStyle.x}px, ${positionStyle.y}px) 
                    rotate(${rotation}deg) 
                    scale(${scale * scaleMultiplier})
                `,
                ...shadowStyle
            }}
        >
            <span className="text-4xl md:text-5xl lg:text-6xl drop-shadow-sm pb-1">
                {char.toUpperCase()}
            </span>
        </div>
    );
}
