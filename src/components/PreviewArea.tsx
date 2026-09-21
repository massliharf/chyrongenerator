import { forwardRef, useState, useEffect, useRef } from 'react';
import { Tile } from './Tile';
import { twMerge } from 'tailwind-merge';
import type { AnimationPreset } from '../App';

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
    lineGap: number;
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
    animationPreset: AnimationPreset;
    exportWidth: number;
    exportHeight: number;
    useCustomExportSize: boolean;
    includeBackground: boolean;
    compositionScale?: number;
    setCompositionScale?: (scale: number) => void;
    exportPosX?: number;
    exportPosY?: number;
    onPositionChange?: (x: number, y: number) => void;
    enableSnapping?: boolean;
    isExporting?: boolean;
}

export const PreviewArea = forwardRef<HTMLDivElement, PreviewAreaProps>(
    ({
        text, subtitle,
        subtitlePos, subtitleSize, subtitlePadding, subtitleRadius,
        tileColor, textColor, subTileColor, subTextColor,
        chaosLevel, tileSize, tileGap, lineGap, shadowOffset, shadowChaos,
        borderRadius, tilePadding, canvasBg, scaleChaos, posChaos,
        fontFamily, bannerGap, blackBgBlur, compositionShadow,
        animationProgress, animationPreset,
        exportWidth, exportHeight, useCustomExportSize, includeBackground,
        exportAlignment = 'center',
        compositionScale = 1.0,
        setCompositionScale,
        exportPosX = 0,
        exportPosY = 0,
        onPositionChange,
        enableSnapping = true,
        isExporting = false
    }, ref) => {

        const containerRef = useRef<HTMLDivElement>(null);
        const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

        useEffect(() => {
            if (!containerRef.current) return;
            const updateSize = () => {
                if (containerRef.current) {
                    setContainerSize({
                        width: containerRef.current.clientWidth,
                        height: containerRef.current.clientHeight,
                    });
                }
            };
            updateSize();
            const ro = new ResizeObserver(updateSize);
            ro.observe(containerRef.current);
            return () => ro.disconnect();
        }, []);

        // Calculate preview scale to fit the exact export dimensions inside the preview container
        const paddingX = 60;
        const paddingY = 90;
        const availW = Math.max(100, containerSize.width - paddingX);
        const availH = Math.max(100, containerSize.height - paddingY);
        const scaleX = availW / (exportWidth || 1920);
        const scaleY = availH / (exportHeight || 1080);
        const previewScale = Math.min(scaleX, scaleY, 1);

        // Split text into lines to support multiline
        const lines = text.split('\n');

        // --- Subtitle Animation Logic ---
        const getSubtitleStyle = () => {
            if (animationPreset === 'none') return {};

            // Start subtitle animation after text is mostly done
            const start = 0.55;
            let t = (animationProgress - start) / 0.45;
            t = Math.max(0, Math.min(1, t));

            // Easing
            const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
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
            const fadeIn = (x: number): number => Math.min(1, x * 4);

            if (animationPreset === 'pop') {
                const scaleAnim = easeOutBack(t);
                return {
                    transform: `scale(${scaleAnim}) rotate(-1deg)`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'slide') {
                const yAnim = (1 - easeOutCubic(t)) * 40;
                return {
                    transform: `translateY(${yAnim}px) rotate(-1deg)`,
                    opacity: easeOutCubic(t)
                };
            } else if (animationPreset === 'typewriter') {
                return {
                    opacity: easeOutCubic(t),
                    transform: `rotate(-1deg)`
                };
            } else if (animationPreset === 'bounce') {
                const yAnim = (1 - easeOutBounce(t)) * 60;
                return {
                    transform: `translateY(-${yAnim}px) rotate(-1deg)`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'flip') {
                const flipT = easeOutCubic(t);
                const flipAngle = (1 - flipT) * 90;
                return {
                    transform: `perspective(800px) rotateY(${flipAngle}deg) rotate(-1deg)`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'wave') {
                const easedT = easeOutCubic(t);
                const waveY = Math.sin(t * Math.PI * 2) * 12 * (1 - easedT);
                const scaleWave = 0.4 + 0.6 * easedT;
                return {
                    transform: `translateY(${waveY}px) scale(${scaleWave}) rotate(-1deg)`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'elastic') {
                const elasticScale = easeOutElastic(t);
                return {
                    transform: `scale(${elasticScale}) rotate(-1deg)`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'glitch') {
                const glitchX = t < 0.85 ? Math.sin(animationProgress * 80) * 15 * Math.pow(1 - t, 2) : 0;
                const flickerRaw = Math.sin(animationProgress * 300);
                const flicker = t < 0.6 ? (flickerRaw > -0.3 ? 1 : 0.2) : 1;
                return {
                    transform: `translateX(${glitchX}px) rotate(-1deg)`,
                    opacity: t < 0.02 ? 0 : flicker
                };
            } else if (animationPreset === 'zoom') {
                const scaleAnim = 1.8 - 0.8 * easeOutCubic(t);
                return {
                    transform: `scale(${scaleAnim}) rotate(-1deg)`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'spin') {
                const spinAngle = (1 - easeOutCubic(t)) * -180;
                return {
                    transform: `rotate(${spinAngle - 1}deg) scale(${easeOutBack(t)})`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'cascade') {
                const yAnim = (1 - easeOutBounce(t)) * -50;
                return {
                    transform: `translateY(${yAnim}px) rotate(-1deg)`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'shutter') {
                const flipX = (1 - easeOutCubic(t)) * -90;
                return {
                    transform: `perspective(600px) rotateX(${flipX}deg) rotate(-1deg)`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'swing') {
                const swingAngle = Math.sin((1 - t) * Math.PI * 3.5) * 20 * Math.pow(1 - t, 2);
                return {
                    transformOrigin: 'top center',
                    transform: `rotate(${swingAngle - 1}deg)`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'drift') {
                const driftX = (1 - easeOutCubic(t)) * -100;
                const skewAngle = (1 - easeOutCubic(t)) * 18;
                return {
                    transform: `translateX(${driftX}px) skewX(${skewAngle}deg) rotate(-1deg)`,
                    opacity: fadeIn(t)
                };
            } else if (animationPreset === 'pulse') {
                const pulseScale = t < 0.6
                    ? easeOutBack(t / 0.6) * 1.15
                    : 1 + Math.sin((t - 0.6) / 0.4 * Math.PI * 2) * 0.1 * Math.pow(1 - t, 1.5);
                return {
                    transform: `scale(${pulseScale}) rotate(-1deg)`,
                    opacity: fadeIn(t)
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

        // Render the inner artwork (tiles + subtitle + effects)
        const renderArtwork = () => (
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
                            "transform rotate-[-1deg] origin-center",
                            animationProgress === 1 && "transition-all duration-300"
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

                <div className="flex flex-col items-center" style={{ gap: `${lineGap}px` }}>
                    {lines.map((line, lineIndex) => (
                        <div
                            key={lineIndex}
                            className="flex flex-nowrap w-max items-center justify-center"
                            style={{ gap: `${tileGap}px` }}
                        >
                            {line.split('').map((char, charIndex) => {
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
                            "transform rotate-[-1deg] origin-center",
                            animationProgress === 1 && "transition-all duration-300"
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
        );

        // Refs & state for interaction
        const artworkBoxRef = useRef<HTMLDivElement>(null);
        const [isDragging, setIsDragging] = useState(false);
        const [isScaling, setIsScaling] = useState(false);
        const [activeCorner, setActiveCorner] = useState<string | null>(null);

        // Snap guides state
        const [snapGuides, setSnapGuides] = useState({
            centerX: false,
            centerY: false,
            lowerThird: false,
            topBanner: false,
        });

        const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number } | null>(null);
        const scaleStartRef = useRef<{
            startX: number;
            startY: number;
            initScale: number;
            centerX: number;
            centerY: number;
            initDist: number;
        } | null>(null);

        // --- Move Dragging Logic with Magnetic Snapping ---
        const handlePointerDown = (e: React.PointerEvent) => {
            if (!useCustomExportSize || isScaling) return;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setIsDragging(true);
            dragStartRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                initPosX: exportPosX || 0,
                initPosY: exportPosY || 0,
            };
        };

        const handlePointerMove = (e: React.PointerEvent) => {
            if (!isDragging || !dragStartRef.current || !onPositionChange) return;
            const dx = (e.clientX - dragStartRef.current.startX) / previewScale;
            const dy = (e.clientY - dragStartRef.current.startY) / previewScale;
            let targetX = Math.round(dragStartRef.current.initPosX + dx);
            let targetY = Math.round(dragStartRef.current.initPosY + dy);

            if (enableSnapping) {
                const snapThreshold = 18; // px on canvas
                const lowerThirdY = Math.round(exportHeight * 0.28);
                const topBannerY = -Math.round(exportHeight * 0.28);

                let snapX = false;
                let snapYCenter = false;
                let snapYLower = false;
                let snapYTop = false;

                // Snap X to Center
                if (Math.abs(targetX) < snapThreshold) {
                    targetX = 0;
                    snapX = true;
                }

                // Snap Y to Center, Lower 3rd, or Top Banner
                if (Math.abs(targetY) < snapThreshold) {
                    targetY = 0;
                    snapYCenter = true;
                } else if (Math.abs(targetY - lowerThirdY) < snapThreshold) {
                    targetY = lowerThirdY;
                    snapYLower = true;
                } else if (Math.abs(targetY - topBannerY) < snapThreshold) {
                    targetY = topBannerY;
                    snapYTop = true;
                }

                setSnapGuides({
                    centerX: snapX,
                    centerY: snapYCenter,
                    lowerThird: snapYLower,
                    topBanner: snapYTop,
                });
            } else {
                setSnapGuides({ centerX: false, centerY: false, lowerThird: false, topBanner: false });
            }

            onPositionChange(targetX, targetY);
        };

        const handlePointerUp = (e: React.PointerEvent) => {
            if (isDragging) {
                setIsDragging(false);
                setSnapGuides({ centerX: false, centerY: false, lowerThird: false, topBanner: false });
                try {
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {
                    // ignore
                }
            }
        };

        // --- Corner Handle Scaling Logic ---
        const handleCornerPointerDown = (corner: string, e: React.PointerEvent) => {
            if (!useCustomExportSize) return;
            e.stopPropagation(); // Don't trigger move drag!
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setIsScaling(true);
            setActiveCorner(corner);

            if (artworkBoxRef.current) {
                const rect = artworkBoxRef.current.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const initDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

                scaleStartRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    initScale: compositionScale,
                    centerX,
                    centerY,
                    initDist: Math.max(15, initDist),
                };
            }
        };

        const handleCornerPointerMove = (e: React.PointerEvent) => {
            if (!isScaling || !scaleStartRef.current || !setCompositionScale) return;
            const { centerX, centerY, initDist, initScale } = scaleStartRef.current;
            const currentDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
            let newScale = (currentDist / initDist) * initScale;

            // Snap scale to 100% (1.0) if close
            if (enableSnapping && Math.abs(newScale - 1.0) < 0.04) {
                newScale = 1.0;
            }

            newScale = Math.max(0.2, Math.min(2.5, Math.round(newScale * 100) / 100));
            setCompositionScale(newScale);
        };

        const handleCornerPointerUp = (e: React.PointerEvent) => {
            if (isScaling) {
                setIsScaling(false);
                setActiveCorner(null);
                try {
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {
                    // ignore
                }
            }
        };

        // MODE 1: Custom Export Size (Shows exact export canvas bounds, centered artwork, zero squeeze)
        if (useCustomExportSize) {
            return (
                <div
                    ref={containerRef}
                    className="w-full h-full flex flex-col items-center justify-center p-6 gap-3 overflow-hidden relative select-none"
                >
                    {/* Frame Info Toolbar (Notion Database View Bar) */}
                    <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-white border border-[#e5e3df] text-[12px] text-[#37352f] shadow-xs z-30 font-medium">
                        <div className="flex items-center gap-1.5 text-[#5645d4]">
                            <span className="w-2 h-2 rounded-full bg-[#5645d4] animate-pulse" />
                            <span className="font-semibold text-[#1a1a1a]">Canvas: {exportWidth} × {exportHeight}</span>
                        </div>
                        <span className="text-[#e5e3df]">|</span>
                        <span className="text-[#787671]">Scale: <strong className="font-mono text-[#37352f] font-semibold">{Math.round(compositionScale * 100)}%</strong></span>
                        <span className="text-[#e5e3df]">|</span>
                        <span className="text-[#787671]">Pos: <strong className="font-mono text-[#37352f] font-medium">{exportPosX}px, {exportPosY}px</strong></span>
                        <span className="text-[#e5e3df]">|</span>
                        <span className={twMerge(
                            "notion-tag",
                            includeBackground ? "notion-tag-peach" : "notion-tag-mint"
                        )}>
                            <span className={twMerge("w-1.5 h-1.5 rounded-full", includeBackground ? "bg-[#793400]" : "bg-[#1aae39]")} />
                            {includeBackground ? "Solid BG" : "Alpha (Transparent)"}
                        </span>
                        <span className="text-[#e5e3df]">|</span>
                        <span className="text-[#a4a097] font-mono text-[11px] font-medium">{Math.round(previewScale * 100)}% view</span>
                    </div>

                    {/* Artboard Sizer (Visual Frame in layout - Notion Mockup Card) */}
                    <div
                        style={{
                            width: `${exportWidth * previewScale}px`,
                            height: `${exportHeight * previewScale}px`,
                        }}
                        className="relative flex items-center justify-center rounded-xl overflow-hidden border border-[#e5e3df] bg-white ring-1 ring-black/5 shadow-[0_20px_45px_-10px_rgba(15,15,15,0.14)]"
                    >
                        {/* Action Safe (90%) Guide */}
                        <div className="absolute inset-[5%] border border-dashed border-[#c8c4be]/60 pointer-events-none rounded-lg z-20 flex items-start justify-end p-2">
                            <span className="text-[9px] font-mono text-[#787671] tracking-wider uppercase select-none font-medium">Action Safe (90%)</span>
                        </div>

                        {/* Center Guides (Faint Crosshairs) */}
                        <div className="absolute inset-0 pointer-events-none z-10 opacity-20">
                            <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-[#787671]" />
                            <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-[#787671]" />
                        </div>

                        {/* Active Magnetic Snap Guide Lines */}
                        {snapGuides.centerX && (
                            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0 border-l-2 border-dashed border-[#5645d4] pointer-events-none z-30 shadow-[0_0_12px_rgba(86,69,212,0.6)] flex items-center justify-start">
                                <span className="bg-[#5645d4] text-white font-semibold font-mono text-[9px] px-2 py-0.5 rounded shadow ml-1 uppercase tracking-wider">
                                    Center X Snap
                                </span>
                            </div>
                        )}
                        {snapGuides.centerY && (
                            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0 border-t-2 border-dashed border-[#5645d4] pointer-events-none z-30 shadow-[0_0_12px_rgba(86,69,212,0.6)] flex items-start justify-center">
                                <span className="bg-[#5645d4] text-white font-semibold font-mono text-[9px] px-2 py-0.5 rounded shadow -mt-2.5 uppercase tracking-wider">
                                    Center Y Snap
                                </span>
                            </div>
                        )}
                        {snapGuides.lowerThird && (
                            <div
                                style={{ top: `${50 + 28}%` }}
                                className="absolute left-0 right-0 -translate-y-1/2 h-0 border-t-2 border-dashed border-[#d9730d] pointer-events-none z-30 shadow-[0_0_12px_rgba(217,115,13,0.5)] flex items-start justify-center"
                            >
                                <span className="bg-[#d9730d] text-white font-semibold font-mono text-[9px] px-2 py-0.5 rounded shadow -mt-2.5 uppercase tracking-wider">
                                    Lower 3rd Snap
                                </span>
                            </div>
                        )}
                        {snapGuides.topBanner && (
                            <div
                                style={{ top: `${50 - 28}%` }}
                                className="absolute left-0 right-0 -translate-y-1/2 h-0 border-t-2 border-dashed border-[#cb912f] pointer-events-none z-30 shadow-[0_0_12px_rgba(203,145,47,0.5)] flex items-start justify-center"
                            >
                                <span className="bg-[#cb912f] text-white font-semibold font-mono text-[9px] px-2 py-0.5 rounded shadow -mt-2.5 uppercase tracking-wider">
                                    Top Banner Snap
                                </span>
                            </div>
                        )}

                        {/* The Export Node (Captured at 100% full resolution with transform='none' and backgroundColor='transparent') */}
                        <div
                            ref={ref}
                            style={{
                                width: `${exportWidth}px`,
                                height: `${exportHeight}px`,
                                transform: `scale(${previewScale})`,
                                transformOrigin: 'top left',
                                backgroundColor: canvasBg,
                            }}
                            className="absolute top-0 left-0 flex flex-col items-center justify-center"
                        >
                            <div
                                ref={artworkBoxRef}
                                style={{
                                    transform: `translate(${exportPosX}px, ${exportPosY}px) scale(${compositionScale})`,
                                    transformOrigin: 'center center',
                                }}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                className={twMerge(
                                    "relative z-20 p-8 flex items-center justify-center transition-[box-shadow] duration-150 group",
                                    isDragging
                                        ? "cursor-grabbing ring-2 ring-[#5645d4] rounded-lg bg-[#5645d4]/5 shadow-xl"
                                        : "cursor-grab hover:ring-1 hover:ring-[#5645d4]/60 rounded-lg"
                                )}
                                title="Drag body to move (snaps to guides) • Drag corner handles to scale"
                            >
                                {/* Corner Scale Handles (Visible in preview, ignored during export) */}
                                {useCustomExportSize && !isExporting && (
                                    <div className="export-ignore absolute inset-0 pointer-events-none rounded-lg ring-1 ring-[#5645d4]/30 border border-dashed border-[#5645d4]/40">
                                        {/* Top-Left */}
                                        <div
                                            onPointerDown={(e) => handleCornerPointerDown('tl', e)}
                                            onPointerMove={handleCornerPointerMove}
                                            onPointerUp={handleCornerPointerUp}
                                            className={twMerge(
                                                "pointer-events-auto absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-[#5645d4] rounded-sm shadow-sm cursor-nwse-resize hover:scale-125 transition-transform flex items-center justify-center",
                                                activeCorner === 'tl' && "scale-125 ring-2 ring-[#5645d4]/40 bg-[#5645d4]"
                                            )}
                                            title="Drag corner to scale artwork"
                                        >
                                            <div className="w-1.5 h-1.5 bg-[#5645d4] rounded-full" />
                                        </div>
                                        {/* Top-Right */}
                                        <div
                                            onPointerDown={(e) => handleCornerPointerDown('tr', e)}
                                            onPointerMove={handleCornerPointerMove}
                                            onPointerUp={handleCornerPointerUp}
                                            className={twMerge(
                                                "pointer-events-auto absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-[#5645d4] rounded-sm shadow-sm cursor-nesw-resize hover:scale-125 transition-transform flex items-center justify-center",
                                                activeCorner === 'tr' && "scale-125 ring-2 ring-[#5645d4]/40 bg-[#5645d4]"
                                            )}
                                            title="Drag corner to scale artwork"
                                        >
                                            <div className="w-1.5 h-1.5 bg-[#5645d4] rounded-full" />
                                        </div>
                                        {/* Bottom-Left */}
                                        <div
                                            onPointerDown={(e) => handleCornerPointerDown('bl', e)}
                                            onPointerMove={handleCornerPointerMove}
                                            onPointerUp={handleCornerPointerUp}
                                            className={twMerge(
                                                "pointer-events-auto absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-[#5645d4] rounded-sm shadow-sm cursor-nesw-resize hover:scale-125 transition-transform flex items-center justify-center",
                                                activeCorner === 'bl' && "scale-125 ring-2 ring-[#5645d4]/40 bg-[#5645d4]"
                                            )}
                                            title="Drag corner to scale artwork"
                                        >
                                            <div className="w-1.5 h-1.5 bg-[#5645d4] rounded-full" />
                                        </div>
                                        {/* Bottom-Right */}
                                        <div
                                            onPointerDown={(e) => handleCornerPointerDown('br', e)}
                                            onPointerMove={handleCornerPointerMove}
                                            onPointerUp={handleCornerPointerUp}
                                            className={twMerge(
                                                "pointer-events-auto absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-[#5645d4] rounded-sm shadow-sm cursor-nwse-resize hover:scale-125 transition-transform flex items-center justify-center",
                                                activeCorner === 'br' && "scale-125 ring-2 ring-[#5645d4]/40 bg-[#5645d4]"
                                            )}
                                            title="Drag corner to scale artwork"
                                        >
                                            <div className="w-1.5 h-1.5 bg-[#5645d4] rounded-full" />
                                        </div>

                                        {/* Scaling live indicator pill */}
                                        {isScaling && (
                                            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 bg-[#0a1530] text-white font-mono font-medium text-[11px] px-2.5 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap">
                                                Scale: {Math.round(compositionScale * 100)}%
                                            </div>
                                        )}
                                    </div>
                                )}

                                {renderArtwork()}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // MODE 2: Natural Tight Crop Mode (Original behavior when custom size is off)
        return (
            <div
                ref={containerRef}
                className="w-full h-full min-h-[400px] flex flex-col items-center justify-center p-8 md:p-12 gap-6 overflow-hidden transition-colors duration-500 relative"
                style={{ backgroundColor: canvasBg }}
            >
                <div
                    ref={ref}
                    style={{
                        transform: `scale(${compositionScale})`,
                        transformOrigin: 'center center',
                    }}
                    className="relative z-20 p-20"
                >
                    {renderArtwork()}
                </div>
            </div>
        );
    });

PreviewArea.displayName = 'PreviewArea';
