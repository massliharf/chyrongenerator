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
}

export const PreviewArea = forwardRef<HTMLDivElement, PreviewAreaProps>(
    ({
        text, subtitle,
        subtitlePos, subtitleSize, subtitlePadding, subtitleRadius,
        tileColor, textColor, subTileColor, subTextColor,
        chaosLevel, tileSize, tileGap, shadowOffset, shadowChaos,
        borderRadius, tilePadding, canvasBg, scaleChaos, posChaos,
        fontFamily
    }, ref) => {

        // Split text into lines to support multiline
        const lines = text.split('\n');

        return (
            <div
                ref={ref}
                className="w-full h-full min-h-[400px] flex flex-col items-center justify-center p-8 md:p-12 gap-6 overflow-hidden transition-colors duration-500"
                style={{ backgroundColor: canvasBg }}
            >
                {/* Main Text Area - Render each line */}
                <div className="flex flex-col items-center relative z-20">
                    {subtitlePos === 'top' && subtitle && (
                        <div
                            className={twMerge(
                                "transform rotate-[-1deg] transition-all duration-300 mb-8",
                            )}
                            style={{
                                zIndex: 10
                            }}
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
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {subtitlePos === 'bottom' && subtitle && (
                        <div
                            className={twMerge(
                                "transform rotate-[-1deg] transition-all duration-300 mt-8",
                            )}
                            style={{
                                zIndex: 10
                            }}
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
        );
    }
);

PreviewArea.displayName = 'PreviewArea';
