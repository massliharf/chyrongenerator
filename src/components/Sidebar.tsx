import { useState, type ReactNode } from 'react';
import { type Preset, type AnimationPreset } from '../App';
import { twMerge } from 'tailwind-merge';
import { MaterialIcon } from './MaterialIcon';

// UI Helpers — Notion Design System (Inter, Sober Rectangles, Hairline Dividers, Material Design Icons)
export const ControlGroup = ({
    title,
    icon: Icon,
    iconName,
    children,
    defaultOpen = false,
    badge
}: {
    title: string;
    icon?: React.ElementType;
    iconName?: string;
    children: ReactNode;
    defaultOpen?: boolean;
    badge?: string;
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-[#e5e3df] last:border-b-0 py-1">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between py-2 px-2 rounded-md hover:bg-[#f0eeec] transition-colors cursor-pointer group select-none text-left"
            >
                <div className="flex items-center gap-2 text-[13px] font-medium text-[#37352f]">
                    <span className="text-[#a4a097] group-hover:text-[#37352f] transition-colors">
                        <MaterialIcon name={isOpen ? "expand_more" : "chevron_right"} className="w-4 h-4" />
                    </span>
                    {iconName ? (
                        <MaterialIcon name={iconName} className="w-4 h-4 text-[#787671]" />
                    ) : Icon ? (
                        <Icon className="w-4 h-4 text-[#787671]" />
                    ) : null}
                    <span className="font-semibold text-[13px] text-[#1a1a1a]">{title}</span>
                </div>
                {badge && (
                    <span className="notion-tag notion-tag-purple text-[10px]">{badge}</span>
                )}
            </button>
            {isOpen && (
                <div className="pt-1 pb-4 px-2 space-y-4 panel-enter">
                    {children}
                </div>
            )}
        </div>
    );
};

export const SliderControl = ({ label, value, onChange, min, max, step, unit = '' }: { label: string, value: number, onChange: (v: number) => void, min: number, max: number, step: number, unit?: string }) => (
    <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
            <label className="text-[#5d5b54] font-medium text-[12px]">{label}</label>
            <span className="text-[#37352f] font-mono text-[11px] font-semibold bg-[#f6f5f4] border border-[#e5e3df] px-1.5 py-0.5 rounded">
                {value}{unit}
            </span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="clean-slider"
        />
    </div>
);

// Sidebar props remain unchanged
interface SidebarProps {
    text: string; setText: (v: string) => void;
    subtitle: string; setSubtitle: (v: string) => void;
    subtitlePos: 'top' | 'bottom'; setSubtitlePos: (v: 'top' | 'bottom') => void;
    subtitleSize: number; setSubtitleSize: (v: number) => void;
    subtitlePadding: { x: number, y: number }; setSubtitlePadding: (v: { x: number, y: number }) => void;
    subtitleRadius: number; setSubtitleRadius: (v: number) => void;
    tileColor: string; setTileColor: (v: string) => void;
    textColor: string; setTextColor: (v: string) => void;
    subTileColor: string; setSubTileColor: (v: string) => void;
    subTextColor: string; setSubTextColor: (v: string) => void;
    chaosLevel: number; setChaosLevel: (v: number) => void;
    onDownload: () => void; onDownloadSvg: () => void; isDownloading: boolean;
    tileSize: number; setTileSize: (v: number) => void;
    tileGap: number; setTileGap: (v: number) => void;
    lineGap: number; setLineGap: (v: number) => void;
    shadowOffset: number; setShadowOffset: (v: number) => void;
    shadowChaos: number; setShadowChaos: (v: number) => void;
    borderRadius: number; setBorderRadius: (v: number) => void;
    tilePadding: number; setTilePadding: (v: number) => void;
    canvasBg: string; setCanvasBg: (v: string) => void;
    scaleChaos: number; setScaleChaos: (v: number) => void;
    posChaos: number; setPosChaos: (v: number) => void;
    fontFamily: string; setFontFamily: (v: string) => void;
    bannerGap: number; setBannerGap: (v: number) => void;
    blackBgBlur: boolean; setBlackBgBlur: (v: boolean) => void;
    compositionShadow: number; setCompositionShadow: (v: number) => void;
    presets: Preset[]; onSavePreset: (name: string) => void; onLoadPreset: (preset: Preset) => void; onDeletePreset: (id: string) => void; onResetDefaults: () => void;
    animationPreset: AnimationPreset; setAnimationPreset: (v: AnimationPreset) => void;
    animationDuration: number; setAnimationDuration: (v: number) => void;
    onPlayAnimation: () => void; onDownloadVideo: () => void; isExportingVideo: boolean; videoProgress: number;
    // Export settings
    exportWidth: number; setExportWidth: (v: number) => void;
    exportHeight: number; setExportHeight: (v: number) => void;
    useCustomExportSize: boolean; setUseCustomExportSize: (v: boolean) => void;
    includeBackground: boolean; setIncludeBackground: (v: boolean) => void;
    exportAlignment: 'center' | 'bottom' | 'top'; setExportAlignment: (v: 'center' | 'bottom' | 'top') => void;
    compositionScale: number; setCompositionScale: (v: number) => void;
    exportPosX: number; setExportPosX: (v: number) => void;
    exportPosY: number; setExportPosY: (v: number) => void;
    enableSnapping: boolean; setEnableSnapping: (v: boolean) => void;
}

export function Sidebar({
    text, setText, subtitle, setSubtitle, subtitlePos, setSubtitlePos,
    subtitleSize, setSubtitleSize, subtitlePadding, setSubtitlePadding, subtitleRadius, setSubtitleRadius,
    tileColor, setTileColor, textColor, setTextColor, subTileColor, setSubTileColor, subTextColor, setSubTextColor,
    chaosLevel, setChaosLevel, tileSize, setTileSize, tileGap, setTileGap, lineGap, setLineGap,
    shadowOffset, setShadowOffset, shadowChaos, setShadowChaos, borderRadius, setBorderRadius,
    tilePadding, setTilePadding, canvasBg, setCanvasBg, scaleChaos, setScaleChaos, posChaos, setPosChaos,
    onDownload, isDownloading, onDownloadSvg, fontFamily, setFontFamily, bannerGap, setBannerGap,
    blackBgBlur, setBlackBgBlur, compositionShadow, setCompositionShadow,
    presets, onSavePreset, onLoadPreset, onDeletePreset, onResetDefaults,
    animationPreset, setAnimationPreset, animationDuration, setAnimationDuration,
    onPlayAnimation, onDownloadVideo, isExportingVideo, videoProgress,
    exportWidth, setExportWidth, exportHeight, setExportHeight,
    useCustomExportSize, setUseCustomExportSize, includeBackground, setIncludeBackground,
    exportAlignment, setExportAlignment,
    compositionScale, setCompositionScale, exportPosX, setExportPosX, exportPosY, setExportPosY,
    enableSnapping, setEnableSnapping
}: SidebarProps) {
    const FONTS = [
        "Fredoka One", "Nunito", "Nunito Sans", "Inter", "Roboto", "Oswald",
        "Anton", "Bangers", "Permanent Marker", "Lobster",
        "Pacifico", "Creepster", "Monoton", "Wicked Mouse", "Chewy", "Ranchers"
    ];

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    const inputClasses = "notion-input";
    const labelClasses = "block text-[11px] font-semibold text-[#787671] mb-1.5 uppercase tracking-wider";

    return (
        <div className="w-full md:w-[380px] bg-white border-r border-[#e5e3df] flex flex-col h-full overflow-y-auto clean-scrollbar select-none relative z-20">
            {/* Notion Document Header with Material Design Icon */}
            <div className="p-3.5 border-b border-[#e5e3df] bg-white sticky top-0 z-30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-[#e6e0f5] flex items-center justify-center text-[#5645d4]">
                        <MaterialIcon name="subtitles" className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h2 className="text-[13px] font-semibold text-[#1a1a1a] tracking-tight">Chyron Properties</h2>
                        <p className="text-[11px] text-[#787671]">Block formatting & styling</p>
                    </div>
                </div>
                <button
                    onClick={onResetDefaults}
                    className="text-[11px] font-medium text-[#787671] hover:text-[#1a1a1a] hover:bg-[#f0eeec] px-2 py-1 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                    title="Reset all settings to defaults"
                >
                    <MaterialIcon name="restart_alt" className="w-3.5 h-3.5" />
                    <span>Reset</span>
                </button>
            </div>
            
            <div className="space-y-0 flex-grow p-3.5">
                {/* PRESETS GROUP */}
                <ControlGroup title="Saved Presets" iconName="layers" defaultOpen={false} badge={presets.length > 0 ? `${presets.length}` : undefined}>
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                                placeholder="New preset name..."
                                className={inputClasses}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newPresetName.trim()) {
                                        onSavePreset(newPresetName.trim());
                                        setNewPresetName('');
                                    }
                                }}
                            />
                            <button
                                onClick={() => {
                                    if (newPresetName.trim()) {
                                        onSavePreset(newPresetName.trim());
                                        setNewPresetName('');
                                    }
                                }}
                                disabled={!newPresetName.trim()}
                                className="notion-btn notion-btn-primary px-3 py-1.5 text-[13px] h-[38px] flex-shrink-0"
                            >
                                Save
                            </button>
                        </div>

                        {presets.length > 0 && (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 clean-scrollbar pt-1">
                                {presets.map((preset) => (
                                    <div key={preset.id} className="flex items-center justify-between p-2 rounded-md hover:bg-[#f6f5f4] border border-[#e5e3df] group transition-all">
                                        <button
                                            onClick={() => onLoadPreset(preset)}
                                            className="text-[13px] font-medium text-[#1a1a1a] text-left flex-1 cursor-pointer truncate"
                                        >
                                            {preset.name}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeletePreset(preset.id);
                                            }}
                                            className="p-1 text-[#a4a097] hover:text-[#e03131] rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                            title="Delete preset"
                                        >
                                            <MaterialIcon name="delete_outline" className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {presets.length === 0 && (
                            <div className="text-[12px] text-[#a4a097] text-center py-3 bg-[#fafaf9] border border-dashed border-[#e5e3df] rounded-md">
                                No saved presets
                            </div>
                        )}
                    </div>
                </ControlGroup>

                {/* 1. CONTENT GROUP */}
                <ControlGroup title="Content & Font" iconName="text_fields" defaultOpen={true}>
                    <div className="space-y-3.5">
                        <div>
                            <label className={labelClasses}>Main Text</label>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className={`${inputClasses} min-h-[85px] resize-y font-semibold leading-snug`}
                                placeholder="Enter text..."
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>Font Family</label>
                            <select
                                value={fontFamily}
                                onChange={(e) => setFontFamily(e.target.value)}
                                className={inputClasses}
                            >
                                {FONTS.map(font => (
                                    <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Subtitle Text</label>
                            <input
                                type="text"
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                className={inputClasses}
                                placeholder="Subtitle text..."
                            />
                        </div>
                    </div>
                </ControlGroup>

                {/* ADVANCED EXPANSION TOGGLE */}
                <div className="py-2 border-b border-[#e5e3df]">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="notion-btn notion-btn-ghost w-full py-1.5 text-[12px] font-medium flex items-center justify-center gap-1.5 text-[#787671] hover:text-[#1a1a1a]"
                    >
                        <span>{showAdvanced ? 'Collapse Advanced Controls' : 'Show Advanced Controls'}</span>
                        <MaterialIcon name={showAdvanced ? "expand_more" : "chevron_right"} className="w-3.5 h-3.5" />
                    </button>
                </div>

                {showAdvanced && (
                    <div className="space-y-0 animate-in fade-in slide-in-from-top-3 duration-200">
                        
                        {/* SUBTITLE SETTINGS */}
                        <ControlGroup title="Subtitle Adjustments" iconName="subtitles" defaultOpen={true}>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelClasses}>Alignment</label>
                                    <div className="grid grid-cols-2 gap-1 bg-[#f6f5f4] p-1 rounded-md border border-[#e5e3df]">
                                        <button
                                            onClick={() => setSubtitlePos('top')}
                                            className={`px-3 py-1 rounded text-[12px] font-medium transition-all cursor-pointer ${
                                                subtitlePos === 'top'
                                                    ? 'bg-white text-[#1a1a1a] shadow-xs font-semibold'
                                                    : 'text-[#787671] hover:text-[#1a1a1a]'
                                            }`}
                                        >
                                            Top
                                        </button>
                                        <button
                                            onClick={() => setSubtitlePos('bottom')}
                                            className={`px-3 py-1 rounded text-[12px] font-medium transition-all cursor-pointer ${
                                                subtitlePos === 'bottom'
                                                    ? 'bg-white text-[#1a1a1a] shadow-xs font-semibold'
                                                    : 'text-[#787671] hover:text-[#1a1a1a]'
                                            }`}
                                        >
                                            Bottom
                                        </button>
                                    </div>
                                </div>

                                <SliderControl label="Scale" value={subtitleSize} onChange={setSubtitleSize} min={0.5} max={4} step={0.1} unit="rem" />
                                <SliderControl label="Horizontal Padding" value={subtitlePadding.x} onChange={(v) => setSubtitlePadding({ ...subtitlePadding, x: v })} min={0} max={60} step={2} unit="px" />
                                <SliderControl label="Vertical Padding" value={subtitlePadding.y} onChange={(v) => setSubtitlePadding({ ...subtitlePadding, y: v })} min={0} max={40} step={2} unit="px" />
                                <SliderControl label="Border Roundness" value={subtitleRadius} onChange={setSubtitleRadius} min={0} max={100} step={2} unit="px" />
                                <SliderControl label="Banner Gap" value={bannerGap} onChange={setBannerGap} min={0} max={100} step={4} unit="px" />
                            </div>
                        </ControlGroup>

                        {/* ANIMATION */}
                        <ControlGroup title="Animation & Transitions" iconName="movie" defaultOpen={false} badge={animationPreset !== 'none' ? animationPreset : undefined}>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelClasses}>Transition Style</label>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {([
                                            'none', 'pop', 'slide', 'typewriter',
                                            'bounce', 'flip', 'wave', 'elastic',
                                            'glitch', 'zoom', 'spin', 'cascade',
                                            'shutter', 'swing', 'drift', 'pulse'
                                        ] as AnimationPreset[]).map((preset) => (
                                            <button
                                                key={preset}
                                                onClick={() => setAnimationPreset(preset)}
                                                className={twMerge(
                                                    "px-1.5 py-1.5 text-[10.5px] font-medium rounded-md border transition-all capitalize cursor-pointer text-center truncate",
                                                    animationPreset === preset
                                                        ? "bg-[#e6e0f5] text-[#391c57] border-[#d6b6f6] font-semibold shadow-xs"
                                                        : "bg-white text-[#5d5b54] border-[#e5e3df] hover:bg-[#f6f5f4] hover:text-[#1a1a1a]"
                                                )}
                                                title={`Animation preset: ${preset}`}
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {animationPreset !== 'none' && (
                                    <>
                                        <SliderControl label="Duration" value={animationDuration} onChange={setAnimationDuration} min={0.5} max={5} step={0.1} unit="s" />

                                        <button
                                            onClick={onPlayAnimation}
                                            className="notion-btn notion-btn-dark w-full py-2 text-[13px] gap-2"
                                        >
                                            <MaterialIcon name="play_arrow" className="w-4 h-4" /> Preview Motion
                                        </button>
                                        
                                        <div className="pt-3 border-t border-[#e5e3df]">
                                            <button
                                                onClick={onDownloadVideo}
                                                disabled={isExportingVideo}
                                                className="notion-btn notion-btn-primary w-full py-2.5 text-[13px] gap-2"
                                            >
                                                {isExportingVideo ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white"></div>
                                                        Rendering {videoProgress}%
                                                    </>
                                                ) : (
                                                    <>
                                                        <MaterialIcon name="videocam" className="w-4 h-4" />
                                                        Export WebM (Alpha Video)
                                                    </>
                                                )}
                                            </button>
                                            <p className="text-[11px] text-[#787671] mt-1.5 text-center">
                                                Transparent alpha channel video for OBS & editors.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </ControlGroup>

                        {/* EXPORT SETTINGS */}
                        <ControlGroup title="Canvas & Resolution" iconName="aspect_ratio" defaultOpen={false}>
                            <div className="space-y-4">
                                {/* Include Background Toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-[12px] font-medium text-[#1a1a1a]">Include Background</label>
                                        <p className="text-[11px] text-[#787671]">Export with canvas color or transparent alpha</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={includeBackground} onChange={(e) => setIncludeBackground(e.target.checked)} className="sr-only peer" />
                                        <div className={`toggle-track w-8 h-5 rounded-full peer-focus:outline-none ${includeBackground ? 'active' : ''}`}></div>
                                    </label>
                                </div>

                                {/* Custom Size Toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-[12px] font-medium text-[#1a1a1a]">Custom Dimensions</label>
                                        <p className="text-[11px] text-[#787671]">Set specific export resolution</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={useCustomExportSize} onChange={(e) => setUseCustomExportSize(e.target.checked)} className="sr-only peer" />
                                        <div className={`toggle-track w-8 h-5 rounded-full peer-focus:outline-none ${useCustomExportSize ? 'active' : ''}`}></div>
                                    </label>
                                </div>

                                {useCustomExportSize && (
                                    <div className="space-y-3.5 panel-enter">
                                        {/* Preset Sizes */}
                                        <div>
                                            <label className={labelClasses}>Presets</label>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {[
                                                    { label: '1920×1080 (16:9)', w: 1920, h: 1080 },
                                                    { label: '1080×1080 (1:1)', w: 1080, h: 1080 },
                                                    { label: '1080×1920 (9:16)', w: 1080, h: 1920 },
                                                    { label: '1280×720 (HD)', w: 1280, h: 720 },
                                                    { label: '720×480 (SD)', w: 720, h: 480 },
                                                ].map(({ label, w, h }) => (
                                                    <button
                                                        key={label}
                                                        onClick={() => { setExportWidth(w); setExportHeight(h); }}
                                                        className={twMerge(
                                                            "px-2 py-1.5 text-[11px] font-medium rounded-md border transition-all text-center cursor-pointer",
                                                            exportWidth === w && exportHeight === h
                                                                ? "bg-[#e6e0f5] text-[#391c57] border-[#d6b6f6] font-semibold shadow-xs"
                                                                : "bg-white text-[#5d5b54] border-[#e5e3df] hover:bg-[#f6f5f4]"
                                                        )}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Custom Width/Height */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className={labelClasses}>Width (px)</label>
                                                <input
                                                    type="number"
                                                    value={exportWidth}
                                                    onChange={(e) => {
                                                        const v = parseInt(e.target.value);
                                                        if (!isNaN(v)) setExportWidth(v);
                                                    }}
                                                    onBlur={() => { if (exportWidth < 100) setExportWidth(100); }}
                                                    className={`${inputClasses} font-mono`}
                                                    min={100}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClasses}>Height (px)</label>
                                                <input
                                                    type="number"
                                                    value={exportHeight}
                                                    onChange={(e) => {
                                                        const v = parseInt(e.target.value);
                                                        if (!isNaN(v)) setExportHeight(v);
                                                    }}
                                                    onBlur={() => { if (exportHeight < 100) setExportHeight(100); }}
                                                    className={`${inputClasses} font-mono`}
                                                    min={100}
                                                />
                                            </div>
                                        </div>

                                        {/* Artwork Scale Slider */}
                                        <SliderControl
                                            label="Artwork Scale"
                                            value={Math.round(compositionScale * 100)}
                                            onChange={(v) => setCompositionScale(Math.round(v) / 100)}
                                            min={20}
                                            max={250}
                                            step={5}
                                            unit="%"
                                        />

                                        {/* Artwork Position X & Y Sliders */}
                                        <div className="space-y-3 pt-1 border-t border-[#e5e3df]">
                                            <SliderControl
                                                label="Horizontal Offset (X)"
                                                value={exportPosX}
                                                onChange={setExportPosX}
                                                min={-Math.round(exportWidth / 2)}
                                                max={Math.round(exportWidth / 2)}
                                                step={2}
                                                unit="px"
                                            />
                                            <SliderControl
                                                label="Vertical Offset (Y)"
                                                value={exportPosY}
                                                onChange={setExportPosY}
                                                min={-Math.round(exportHeight / 2)}
                                                max={Math.round(exportHeight / 2)}
                                                step={2}
                                                unit="px"
                                            />
                                        </div>

                                        {/* Artwork Placement Presets */}
                                        <div>
                                            <label className={labelClasses}>Quick Placement</label>
                                            <div className="grid grid-cols-3 gap-1 bg-[#f6f5f4] p-1 rounded-md border border-[#e5e3df]">
                                                <button
                                                    onClick={() => { setExportPosX(0); setExportPosY(0); }}
                                                    className={twMerge(
                                                        "px-2 py-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer",
                                                        exportPosX === 0 && exportPosY === 0
                                                            ? "bg-white text-[#1a1a1a] shadow-xs font-semibold"
                                                            : "text-[#787671] hover:text-[#1a1a1a]"
                                                    )}
                                                >
                                                    Center
                                                </button>
                                                <button
                                                    onClick={() => { setExportPosX(0); setExportPosY(Math.round(exportHeight * 0.28)); }}
                                                    className={twMerge(
                                                        "px-2 py-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer",
                                                        exportPosX === 0 && exportPosY === Math.round(exportHeight * 0.28)
                                                            ? "bg-white text-[#1a1a1a] shadow-xs font-semibold"
                                                            : "text-[#787671] hover:text-[#1a1a1a]"
                                                    )}
                                                >
                                                    Lower 3rd
                                                </button>
                                                <button
                                                    onClick={() => { setExportPosX(0); setExportPosY(-Math.round(exportHeight * 0.28)); }}
                                                    className={twMerge(
                                                        "px-2 py-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer",
                                                        exportPosX === 0 && exportPosY === -Math.round(exportHeight * 0.28)
                                                            ? "bg-white text-[#1a1a1a] shadow-xs font-semibold"
                                                            : "text-[#787671] hover:text-[#1a1a1a]"
                                                    )}
                                                >
                                                    Top
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 bg-[#f6f5f4] p-1 rounded-md border border-[#e5e3df] mt-1">
                                                <button
                                                    onClick={() => { setExportPosX(-Math.round(exportWidth * 0.22)); setExportPosY(Math.round(exportHeight * 0.28)); }}
                                                    className="px-2 py-1 rounded text-[11px] font-medium text-[#787671] hover:text-[#1a1a1a] transition-all text-center cursor-pointer"
                                                >
                                                    Bottom Left
                                                </button>
                                                <button
                                                    onClick={() => { setExportPosX(Math.round(exportWidth * 0.22)); setExportPosY(Math.round(exportHeight * 0.28)); }}
                                                    className="px-2 py-1 rounded text-[11px] font-medium text-[#787671] hover:text-[#1a1a1a] transition-all text-center cursor-pointer"
                                                >
                                                    Bottom Right
                                                </button>
                                            </div>
                                        </div>

                                        {/* Magnetic Snapping Toggle */}
                                        <div className="flex items-center justify-between pt-2 border-t border-[#e5e3df]">
                                            <div>
                                                <label className="text-[12px] font-medium text-[#1a1a1a]">Magnetic Snapping</label>
                                                <p className="text-[11px] text-[#787671]">Snap to Center & Lower 3rd guides</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={enableSnapping} onChange={(e) => setEnableSnapping(e.target.checked)} className="sr-only peer" />
                                                <div className={`toggle-track w-8 h-5 rounded-full peer-focus:outline-none ${enableSnapping ? 'active' : ''}`}></div>
                                            </label>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setExportPosX(0);
                                                setExportPosY(0);
                                                setCompositionScale(1.0);
                                            }}
                                            className="notion-btn notion-btn-secondary w-full py-1.5 text-[11px]"
                                        >
                                            Reset Position & Scale
                                        </button>

                                        <div className="text-[12px] text-[#5d5b54] leading-relaxed bg-[#f6f5f4] border border-[#e5e3df] p-2.5 rounded-lg flex items-start gap-2">
                                            <MaterialIcon name="lightbulb" className="w-4 h-4 text-[#cb912f] shrink-0 mt-0.5" />
                                            <span>Drag artwork to reposition (snaps to guides) • Drag corner handles to scale.</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ControlGroup>

                        {/* STYLE GROUP */}
                        <ControlGroup title="Themes & Colors" iconName="palette" defaultOpen={true}>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <div className="space-y-1">
                                        <label className={labelClasses}>Main Tile</label>
                                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-[#e5e3df] hover:border-[#c8c4be] transition-colors">
                                            <input type="color" value={tileColor} onChange={(e) => setTileColor(e.target.value)} className="w-6 h-6 rounded clean-color cursor-pointer" />
                                            <span className="text-[11px] font-mono text-[#37352f] uppercase font-medium">{tileColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClasses}>Main Text</label>
                                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-[#e5e3df] hover:border-[#c8c4be] transition-colors">
                                            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-6 h-6 rounded clean-color cursor-pointer" />
                                            <span className="text-[11px] font-mono text-[#37352f] uppercase font-medium">{textColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClasses}>Sub Banner</label>
                                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-[#e5e3df] hover:border-[#c8c4be] transition-colors">
                                            <input type="color" value={subTileColor} onChange={(e) => setSubTileColor(e.target.value)} className="w-6 h-6 rounded clean-color cursor-pointer" />
                                            <span className="text-[11px] font-mono text-[#37352f] uppercase font-medium">{subTileColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClasses}>Sub Text</label>
                                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-[#e5e3df] hover:border-[#c8c4be] transition-colors">
                                            <input type="color" value={subTextColor} onChange={(e) => setSubTextColor(e.target.value)} className="w-6 h-6 rounded clean-color cursor-pointer" />
                                            <span className="text-[11px] font-mono text-[#37352f] uppercase font-medium">{subTextColor}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-[#fafaf9] border border-[#e5e3df] rounded-lg space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-[12px] font-medium text-[#1a1a1a]">Canvas Background</label>
                                            <p className="text-[11px] text-[#787671]">Preview backdrop color</p>
                                        </div>
                                        <input type="color" value={canvasBg} onChange={(e) => setCanvasBg(e.target.value)} className="w-6 h-6 rounded clean-color shadow-xs" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-[12px] font-medium text-[#1a1a1a]">Dark Backdrop</label>
                                            <p className="text-[11px] text-[#787671]">Blurred backdrop layer</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={blackBgBlur} onChange={(e) => setBlackBgBlur(e.target.checked)} className="sr-only peer" />
                                            <div className={`toggle-track w-8 h-5 rounded-full peer-focus:outline-none ${blackBgBlur ? 'active' : ''}`}></div>
                                        </label>
                                    </div>
                                </div>
                                
                                <SliderControl label="Global Drop Shadow" value={compositionShadow} onChange={setCompositionShadow} min={0} max={50} step={1} unit="px" />
                            </div>
                        </ControlGroup>

                        {/* LAYOUT GROUP */}
                        <ControlGroup title="Dimensions & Geometry" iconName="straighten">
                            <div className="space-y-3.5">
                                <SliderControl label="Scale Factor" value={tileSize} onChange={setTileSize} min={0.5} max={2.5} step={0.1} unit="x" />
                                <SliderControl label="Letter Spacing" value={tileGap} onChange={setTileGap} min={0} max={60} step={1} unit="px" />
                                <SliderControl label="Line Spacing" value={lineGap} onChange={setLineGap} min={0} max={60} step={1} unit="px" />
                                <SliderControl label="Inner Padding" value={tilePadding} onChange={setTilePadding} min={0} max={40} step={1} unit="px" />
                                <SliderControl label="Roundness" value={borderRadius} onChange={setBorderRadius} min={0} max={50} step={1} unit="px" />
                            </div>
                        </ControlGroup>

                        {/* EFFECTS GROUP */}
                        <ControlGroup title="Transforms & Chaos" iconName="tune">
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <h4 className={labelClasses}>Shadows</h4>
                                    <SliderControl label="Depth Offset" value={shadowOffset} onChange={setShadowOffset} min={0} max={40} step={1} unit="px" />
                                    <SliderControl label="Shadow Variation" value={shadowChaos} onChange={setShadowChaos} min={0} max={10} step={0.5} />
                                </div>

                                <div className="space-y-3 pt-2 border-t border-[#e5e3df]">
                                    <h4 className={labelClasses}>Transforms</h4>
                                    <SliderControl label="Tile Chaos" value={chaosLevel} onChange={setChaosLevel} min={0} max={15} step={0.5} unit="°" />
                                    <SliderControl label="Position Jitter" value={posChaos} onChange={setPosChaos} min={0} max={20} step={0.5} unit="px" />
                                    <SliderControl label="Scale Variation" value={scaleChaos} onChange={setScaleChaos} min={0} max={1} step={0.05} />
                                </div>
                            </div>
                        </ControlGroup>
                    </div>
                )}
            </div>

            {/* Actions: Notion Sticky Bottom Bar */}
            <div className="p-3 border-t border-[#e5e3df] bg-white sticky bottom-0 z-30 flex items-center gap-2">
                <button
                    onClick={onDownload}
                    disabled={isDownloading}
                    className="notion-btn notion-btn-primary flex-1 py-2.5 text-[13px] font-medium gap-1.5"
                >
                    <MaterialIcon name="download" className="w-4 h-4" /> Export PNG
                </button>
                <button
                    onClick={onDownloadSvg}
                    disabled={isDownloading}
                    className="notion-btn notion-btn-secondary flex-1 py-2.5 text-[13px] font-medium gap-1.5"
                >
                    <MaterialIcon name="code" className="w-4 h-4" /> Export SVG
                </button>
            </div>

        </div>
    );
}
