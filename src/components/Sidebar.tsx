import { Type, Palette, Layout, Download, ChevronDown, ChevronRight, Play, Clapperboard, Video, Sliders } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { type Preset } from '../App';
import { twMerge } from 'tailwind-merge';

// UI Helpers
const ControlGroup = ({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: React.ElementType, children: ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-gray-100/50 hover:bg-gray-100 transition-colors text-left"
            >
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Icon className="w-4 h-4 text-blue-500" />
                    {title}
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
            </button>
            {isOpen && (
                <div className="p-4 space-y-4 border-t border-gray-200/50">
                    {children}
                </div>
            )}
        </div>
    );
};

const SliderControl = ({ label, value, onChange, min, max, step, unit = '' }: { label: string, value: number, onChange: (v: number) => void, min: number, max: number, step: number, unit?: string }) => (
    <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
            <label className="text-gray-500 font-medium">{label}</label>
            <span className="text-gray-600 font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded">{value}{unit}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
        />
    </div>
);

interface SidebarProps {
    text: string;
    setText: (v: string) => void;
    subtitle: string;
    setSubtitle: (v: string) => void;
    subtitlePos: 'top' | 'bottom';
    setSubtitlePos: (v: 'top' | 'bottom') => void;
    subtitleSize: number;
    setSubtitleSize: (v: number) => void;
    subtitlePadding: { x: number, y: number };
    setSubtitlePadding: (v: { x: number, y: number }) => void;
    subtitleRadius: number;
    setSubtitleRadius: (v: number) => void;
    tileColor: string;
    setTileColor: (v: string) => void;
    textColor: string;
    setTextColor: (v: string) => void;
    subTileColor: string;
    setSubTileColor: (v: string) => void;
    subTextColor: string;
    setSubTextColor: (v: string) => void;
    chaosLevel: number;
    setChaosLevel: (v: number) => void;
    onDownload: () => void;
    onDownloadSvg: () => void;
    isDownloading: boolean;
    tileSize: number;
    setTileSize: (v: number) => void;
    tileGap: number;
    setTileGap: (v: number) => void;
    shadowOffset: number;
    setShadowOffset: (v: number) => void;
    shadowChaos: number;
    setShadowChaos: (v: number) => void;
    borderRadius: number;
    setBorderRadius: (v: number) => void;
    tilePadding: number;
    setTilePadding: (v: number) => void;
    canvasBg: string;
    setCanvasBg: (v: string) => void;
    scaleChaos: number;
    setScaleChaos: (v: number) => void;
    posChaos: number;
    setPosChaos: (v: number) => void;
    fontFamily: string;
    setFontFamily: (v: string) => void;
    bannerGap: number;
    setBannerGap: (v: number) => void;
    blackBgBlur: boolean;
    setBlackBgBlur: (v: boolean) => void;
    compositionShadow: number;
    setCompositionShadow: (v: number) => void;

    presets: Preset[];
    onSavePreset: (name: string) => void;
    onLoadPreset: (preset: Preset) => void;
    onDeletePreset: (id: string) => void;

    // Animation
    animationPreset: 'none' | 'pop' | 'slide' | 'typewriter';
    setAnimationPreset: (v: 'none' | 'pop' | 'slide' | 'typewriter') => void;
    onPlayAnimation: () => void;
    onDownloadVideo: () => void;
    isExportingVideo: boolean;
    videoProgress: number;
}

export function Sidebar({
    text, setText,
    subtitle, setSubtitle,
    subtitlePos, setSubtitlePos,
    subtitleSize, setSubtitleSize,
    subtitlePadding, setSubtitlePadding,
    subtitleRadius, setSubtitleRadius,
    tileColor, setTileColor,
    textColor, setTextColor,
    subTileColor, setSubTileColor,
    subTextColor, setSubTextColor,
    chaosLevel, setChaosLevel,
    tileSize, setTileSize,
    tileGap, setTileGap,
    shadowOffset, setShadowOffset,
    shadowChaos, setShadowChaos,
    borderRadius, setBorderRadius,
    tilePadding, setTilePadding,
    canvasBg, setCanvasBg,
    scaleChaos, setScaleChaos,
    posChaos, setPosChaos,
    onDownload, isDownloading,
    onDownloadSvg,
    fontFamily, setFontFamily,
    bannerGap, setBannerGap,
    blackBgBlur, setBlackBgBlur,
    compositionShadow, setCompositionShadow,
    presets, onSavePreset, onLoadPreset, onDeletePreset,
    animationPreset, setAnimationPreset, onPlayAnimation, onDownloadVideo, isExportingVideo, videoProgress
}: SidebarProps) {
    const FONTS = [
        "Fredoka One", "Nunito", "Nunito Sans", "Inter", "Roboto", "Oswald",
        "Anton", "Bangers", "Permanent Marker", "Lobster",
        "Pacifico", "Creepster", "Monoton", "Wicked Mouse", "Chewy", "Ranchers"
    ];

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    return (
        <div className="w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 p-4 flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar">

            <div className="space-y-3 flex-grow">
                {/* PRESETS GROUP */}
                <ControlGroup title="Presets" icon={Layout} defaultOpen={false}>
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                                placeholder="New preset name..."
                                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                            <button
                                onClick={() => {
                                    if (newPresetName.trim()) {
                                        onSavePreset(newPresetName);
                                        setNewPresetName('');
                                    }
                                }}
                                disabled={!newPresetName.trim()}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save
                            </button>
                        </div>

                        {presets.length > 0 && (
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {presets.map((preset) => (
                                    <div key={preset.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-all group">
                                        <button
                                            onClick={() => onLoadPreset(preset)}
                                            className="text-sm font-medium text-gray-700 hover:text-blue-600 text-left flex-1"
                                        >
                                            {preset.name}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeletePreset(preset.id);
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-500 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete preset"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {presets.length === 0 && (
                            <div className="text-xs text-gray-400 text-center py-2 italic">
                                No saved presets
                            </div>
                        )}
                    </div>
                </ControlGroup>

                {/* 1. CONTENT GROUP (Always Visible) */}
                <ControlGroup title="Content" icon={Type} defaultOpen={true}>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Main Text</label>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all font-bold tracking-wide min-h-[80px] resize-y text-gray-900 placeholder-gray-400"
                                placeholder="TYPE SOMETHING..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Font Family</label>
                            <select
                                value={fontFamily}
                                onChange={(e) => setFontFamily(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all text-gray-900 cursor-pointer"
                            >
                                {FONTS.map(font => (
                                    <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Subtitle Text</label>
                            <input
                                type="text"
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all text-gray-900 placeholder-gray-400"
                                placeholder="Subtitle text..."
                            />
                        </div>
                    </div>
                </ControlGroup>

                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-colors text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                    {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                    {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {showAdvanced && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                        {/* SUBTITLE SETTINGS */}
                        <ControlGroup title="Subtitle Settings" icon={Type} defaultOpen={true}>
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Position</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setSubtitlePos('top')}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${subtitlePos === 'top' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                            >
                                                TOP
                                            </button>
                                            <button
                                                onClick={() => setSubtitlePos('bottom')}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${subtitlePos === 'bottom' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                            >
                                                BOTTOM
                                            </button>
                                        </div>
                                    </div>

                                    <SliderControl label="Scale" value={subtitleSize} onChange={setSubtitleSize} min={0.5} max={4} step={0.1} unit="rem" />
                                    <SliderControl label="Padding X" value={subtitlePadding.x} onChange={(v) => setSubtitlePadding({ ...subtitlePadding, x: v })} min={0} max={60} step={2} unit="px" />
                                    <SliderControl label="Padding Y" value={subtitlePadding.y} onChange={(v) => setSubtitlePadding({ ...subtitlePadding, y: v })} min={0} max={40} step={2} unit="px" />
                                    <SliderControl label="Roundness" value={subtitleRadius} onChange={setSubtitleRadius} min={0} max={100} step={2} unit="px" />
                                    <SliderControl label="Banner Gap" value={bannerGap} onChange={setBannerGap} min={0} max={100} step={4} unit="px" />
                                </div>
                            </div>
                        </ControlGroup>

                        {/* ANIMATION (New Group) */}
                        <ControlGroup title="Animation" icon={Clapperboard} defaultOpen={false}>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Intro Style</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['none', 'pop', 'slide', 'typewriter'].map((preset) => (
                                            <button
                                                key={preset}
                                                onClick={() => setAnimationPreset(preset as SidebarProps['animationPreset'])}
                                                className={twMerge(
                                                    "px-3 py-2 text-sm rounded-lg border transition-all capitalize",
                                                    animationPreset === preset
                                                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-blue-300"
                                                )}
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {animationPreset !== 'none' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={onPlayAnimation}
                                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm bg-blue-600 hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Play className="w-4 h-4" />
                                            Play Preview
                                        </button>
                                    </div>
                                )}

                                {animationPreset !== 'none' && (
                                    <div className="pt-2 border-t border-gray-100">
                                        <button
                                            onClick={onDownloadVideo}
                                            disabled={isExportingVideo}
                                            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isExportingVideo ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                    Exporting {videoProgress}%
                                                </>
                                            ) : (
                                                <>
                                                    <Video className="w-4 h-4" />
                                                    Export Alpha Video (WebM)
                                                </>
                                            )}
                                        </button>
                                        <p className="text-[10px] text-gray-400 mt-2 text-center">
                                            Exports a transparent WebM video. Compatible with OBS, Premiere, After Effects.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </ControlGroup>

                        {/* STYLE GROUP */}
                        <ControlGroup title="Appearance" icon={Palette} defaultOpen={true}>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold ml-1">Tile</label>
                                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                                            <input
                                                type="color"
                                                value={tileColor}
                                                onChange={(e) => setTileColor(e.target.value)}
                                                className="w-8 h-8 rounded-md cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-xs font-mono text-gray-600 truncate">{tileColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold ml-1">Text</label>
                                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                                            <input
                                                type="color"
                                                value={textColor}
                                                onChange={(e) => setTextColor(e.target.value)}
                                                className="w-8 h-8 rounded-md cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-xs font-mono text-gray-600 truncate">{textColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold ml-1">Sub. Bg</label>
                                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                                            <input
                                                type="color"
                                                value={subTileColor}
                                                onChange={(e) => setSubTileColor(e.target.value)}
                                                className="w-8 h-8 rounded-md cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-xs font-mono text-gray-600 truncate">{subTileColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold ml-1">Sub. Text</label>
                                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                                            <input
                                                type="color"
                                                value={subTextColor}
                                                onChange={(e) => setSubTextColor(e.target.value)}
                                                className="w-8 h-8 rounded-md cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-xs font-mono text-gray-600 truncate">{subTextColor}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-gray-200/50 space-y-3">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold ml-1 mb-1 block">Canvas Background</label>
                                        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200">
                                            <input
                                                type="color"
                                                value={canvasBg}
                                                onChange={(e) => setCanvasBg(e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-xs text-gray-600">Preview Background</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-gray-600">Black Blur Backdrop</label>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={blackBgBlur} onChange={(e) => setBlackBgBlur(e.target.checked)} className="sr-only peer" />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    <SliderControl
                                        label="Composition Shadow"
                                        value={compositionShadow}
                                        onChange={setCompositionShadow}
                                        min={0}
                                        max={50}
                                        step={1}
                                        unit="px"
                                    />
                                </div>
                            </div>
                        </ControlGroup>

                        {/* LAYOUT GROUP */}
                        <ControlGroup title="Dimensions" icon={Layout}>
                            <div className="space-y-5">
                                <SliderControl label="Tile Scale" value={tileSize} onChange={setTileSize} min={0.5} max={2.5} step={0.1} unit="x" />
                                <SliderControl label="Spacing" value={tileGap} onChange={setTileGap} min={0} max={60} step={1} unit="px" />
                                <SliderControl label="Padding" value={tilePadding} onChange={setTilePadding} min={0} max={40} step={1} unit="px" />
                                <SliderControl label="Roundness" value={borderRadius} onChange={setBorderRadius} min={0} max={50} step={1} unit="px" />
                            </div>
                        </ControlGroup>

                        {/* EFFECTS GROUP */}
                        <ControlGroup title="Chaos & Effects" icon={Sliders}>
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1">Shadows</h4>
                                    <SliderControl label="Shadow Depth" value={shadowOffset} onChange={setShadowOffset} min={0} max={40} step={1} unit="px" />
                                    <SliderControl label="Shadow Chaos" value={shadowChaos} onChange={setShadowChaos} min={0} max={10} step={0.5} />
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1">Randomness</h4>
                                    <SliderControl label="Rotation Chaos" value={chaosLevel} onChange={setChaosLevel} min={0} max={15} step={0.5} unit="°" />
                                    <SliderControl label="Position Scatter" value={posChaos} onChange={setPosChaos} min={0} max={20} step={0.5} unit="px" />
                                    <SliderControl label="Size Variation" value={scaleChaos} onChange={setScaleChaos} min={0} max={1} step={0.05} />
                                </div>
                            </div>
                        </ControlGroup>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                    onClick={onDownload}
                    disabled={isDownloading}
                    className="py-3 bg-blue-600 hover:bg-blue-500 text-white font-black tracking-wide rounded-xl shadow-lg shadow-blue-900/20 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group text-xs md:text-sm"
                >
                    <Download className="w-4 h-4" />
                    PNG
                </button>
                <button
                    onClick={onDownloadSvg}
                    disabled={isDownloading}
                    className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold tracking-wide rounded-xl border border-gray-300 shadow-lg transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
                >
                    <Download className="w-4 h-4" />
                    SVG
                </button>
            </div>

        </div>
    );
}
