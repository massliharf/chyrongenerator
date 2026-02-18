import { forwardRef } from 'react';
import { Tile } from './Tile';
import { twMerge } from 'tailwind-merge';

interface PreviewAreaProps {
    text: string;
    subtitle: string;
    subtitlePos: 'top' | 'bottom';
    subtitleSize: number;
    subtitlePadding: { x: number, y: number };
    subtitleRadius: number;
    tileColor: string;
    textColor: string;
    subTileColor: string;
    subTextColor: string;
    chaosLevel: number;
    tileSize: number;
    tileGap: number;
    shadowOffset: number;
    shadowChaos: number;
    borderRadius: number;
    tilePadding: number;
    canvasBg: string;
    scaleChaos: number;
    posChaos: number;
    fontFamily: string;
    bannerGap: number;
    blackBgBlur: boolean;
    compositionShadow: number;
    animationProgress: number;
    animationPreset: 'none' | 'pop' | 'slide' | 'typewriter';
}

export const PreviewArea = forwardRef<HTMLDivElement, PreviewAreaProps>(
    ({
        text, subtitle,
        subtitlePos, subtitleSize, subtitlePadding, subtitleRadius,
        tileColor, textColor, subTileColor, subTextColor,
        chaosLevel, tileSize, tileGap, shadowOffset, shadowChaos,
        borderRadius, tilePadding, canvasBg, scaleChaos, posChaos,
        fontFamily, bannerGap, blackBgBlur, compositionShadow,
        animationProgress, animationPreset
    }, ref) => {

        // Split text into lines to support multiline
        const lines = text.split('\n');

        // --- Subtitle Animation Logic ---
        const getSubtitleStyle = () => {
            if (animationPreset === 'none') return {};

            // Start subtitle animation after text is mostly done
            // Let's say text takes ~0.6-0.8 of the progress depending on length.
            // We trigger subtitle at 0.6
            const start = 0.6;
            let t = (animationProgress - start) / 0.4;
            t = Math.max(0, Math.min(1, t));

            // Easing
            const easeOutBack = (x: number): number => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
            };
            const easeOutQuad = (x: number): number => 1 - (1 - x) * (1 - x);

            if (animationPreset === 'pop') {
                const scaleAnim = easeOutBack(t);
                return {
                    transform: `scale(${scaleAnim}) rotate(-1deg)`, // Maintain the -1deg tilt
                    opacity: t < 0.1 ? 0 : 1
                };
            } else if (animationPreset === 'slide') {
                const yAnim = (1 - easeOutQuad(t)) * 50;
                return {
                    transform: `translateY(${yAnim}px) rotate(-1deg)`,
                    opacity: t
                };
            } else if (animationPreset === 'typewriter') {
                // Fade in
                return {
                    opacity: t,
                    transform: `rotate(-1deg)`
                };
            }
            return {};
        };

        const subtitleAnimStyle = getSubtitleStyle();

        // Helper to merge subtitle styles
        const mergedSubtitleContainerStyle = (isTop: boolean) => {
            const base = {
                zIndex: 10,
                [isTop ? 'marginBottom' : 'marginTop']: `${bannerGap}px`,
            };
            if (animationPreset === 'none') return base;
            return { ...base, ...subtitleAnimStyle };
        };

        return (
            <div
                className="w-full h-full min-h-[400px] flex flex-col items-center justify-center p-8 md:p-12 gap-6 overflow-hidden transition-colors duration-500 relative"
                style={{ backgroundColor: canvasBg }}
            >
                {/* ... overlay ... */}

                {/* Main Text Area - Wrapper for Export */}
                <div
                    ref={ref}
                    className="relative z-20 p-20" // Wrapper padding to contain outward shadows/transforms
                >
                    {/* Inner Content - Applies Filter & Layout */}
                    <div
                        className="flex flex-col items-center relative"
                        style={{
                            filter: compositionShadow > 0 ? `drop-shadow(0 0 ${compositionShadow}px rgba(0,0,0,0.6))` : 'none'
                        }}
                    >
                        {/* Conditionally render Black Blur */}
                        {blackBgBlur && (
                            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm -z-10 rounded-xl" style={{ margin: '-20px' }} />
                        )}

                        {subtitlePos === 'top' && subtitle && (
                            <div
                                className={twMerge(
                                    "transform rotate-[-1deg] transition-all duration-300 origin-center",
                                )}
                                style={mergedSubtitleContainerStyle(true)}
                            >
                                <div
                                    className={twMerge(
                                        "font-bold shadow-lg border-b-4",
                                        "transition-colors duration-200"
                                    )}
                                    style={{
                                        backgroundColor: subTileColor,
                                        color: subTextColor,
                                        borderColor: `color-mix(in srgb, ${subTileColor}, black 20%)`,
                                        fontSize: `${subtitleSize}rem`,
                                        padding: `${subtitlePadding.y}px ${subtitlePadding.x}px`,
                                        borderRadius: `${subtitleRadius}px`
                                    }}
                                >
                                    {subtitle.toUpperCase()}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col items-center" style={{ gap: `${tileGap}px` }}>
                            {lines.map((line, lineIndex) => (
                                <div
                                    key={lineIndex}
                                    className="flex flex-wrap items-center justify-center"
                                    style={{ gap: `${tileGap}px`, maxWidth: '100%' }}
                                >
                                    {line.split('').map((char, charIndex) => {
                                        // Calculate global index for alternating rotation continuity
                                        let globalIndex = 0;
                                        for (let i = 0; i < lineIndex; i++) globalIndex += lines[i].length;
                                        globalIndex += charIndex;

                                        if (char === ' ') {
                                            return <div key={`${lineIndex}-${charIndex}`} className="w-4 md:w-6 lg:w-8" />;
                                        }
                                        return (
                                            <Tile
                                                key={`${lineIndex}-${charIndex}`}
                                                index={globalIndex}
                                                char={char}
                                                bgColor={tileColor}
                                                textColor={textColor}
                                                chaosLevel={chaosLevel}
                                                scale={tileSize}
                                                shadowOffset={shadowOffset}
                                                shadowChaos={shadowChaos}
                                                borderRadius={borderRadius}
                                                padding={tilePadding}
                                                scaleChaos={scaleChaos}
                                                posChaos={posChaos}
                                                fontFamily={fontFamily}
                                                animationProgress={animationProgress}
                                                animationPreset={animationPreset}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        {subtitlePos === 'bottom' && subtitle && (
                            <div
                                className={twMerge(
                                    "transform rotate-[-1deg] transition-all duration-300 origin-center",
                                )}
                                style={mergedSubtitleContainerStyle(false)}
                            >
                                <div
                                    className={twMerge(
                                        "font-bold shadow-lg border-b-4",
                                        "transition-colors duration-200"
                                    )}
                                    style={{
                                        backgroundColor: subTileColor,
                                        color: subTextColor,
                                        borderColor: `color-mix(in srgb, ${subTileColor}, black 20%)`,
                                        fontSize: `${subtitleSize}rem`,
                                        padding: `${subtitlePadding.y}px ${subtitlePadding.x}px`,
                                        borderRadius: `${subtitleRadius}px`
                                    }}
                                >
                                    {subtitle.toUpperCase()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    });

PreviewArea.displayName = 'PreviewArea';
