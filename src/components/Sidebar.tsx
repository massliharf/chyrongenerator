import { Type, Palette, Layout, Download, ChevronDown, ChevronRight, Play, Clapperboard, Video, Sliders } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { type Preset } from '../App';
import { twMerge } from 'tailwind-merge';

// UI Helpers - Clean Minimal Style (No weird colors, just white/gray/blue)
export const ControlGroup = ({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: React.ElementType, children: ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-gray-200 last:border-b-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between py-4 group hover:bg-gray-50/50 px-2 -mx-2 rounded-lg transition-colors"
            >
                <div className="flex items-center gap-2.5 text-[13px] font-semibold text-gray-900 tracking-tight">
                    <Icon className="w-4 h-4 text-blue-600" />
                    {title}
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" /> : <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />}
            </button>
            {isOpen && (
                <div className="pb-5 pt-1 space-y-4 panel-enter">
                    {children}
                </div>
            )}
        </div>
    );
};

export const SliderControl = ({ label, value, onChange, min, max, step, unit = '' }: { label: string, value: number, onChange: (v: number) => void, min: number, max: number, step: number, unit?: string }) => (
    <div className="space-y-2.5">
        <div className="flex justify-between items-center text-xs">
            <label className="text-gray-600 font-medium tracking-wide">{label}</label>
            <span className="text-gray-700 font-mono bg-gray-100 px-2 py-0.5 rounded text-[11px] font-medium border border-gray-200">{value}{unit}</span>
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
    animationPreset: 'none' | 'pop' | 'slide' | 'typewriter'; setAnimationPreset: (v: 'none' | 'pop' | 'slide' | 'typewriter') => void;
    onPlayAnimation: () => void; onDownloadVideo: () => void; isExportingVideo: boolean; videoProgress: number;
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
    animationPreset, setAnimationPreset, onPlayAnimation, onDownloadVideo, isExportingVideo, videoProgress
}: SidebarProps) {
    const FONTS = [
        "Fredoka One", "Nunito", "Nunito Sans", "Inter", "Roboto", "Oswald",
        "Anton", "Bangers", "Permanent Marker", "Lobster",
        "Pacifico", "Creepster", "Monoton", "Wicked Mouse", "Chewy", "Ranchers"
    ];

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    const inputClasses = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none shadow-sm placeholder-gray-400 text-gray-900 transition-all";
    const labelClasses = "block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider";

    return (
        <div className="w-full md:w-[380px] bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto clean-scrollbar select-none relative z-20">
            <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-30 shadow-sm flex items-center justify-between">
                <div>
                    <h2 className="text-[14px] font-black text-gray-900 tracking-tight uppercase">Tile Engine</h2>
                    <p className="text-[11px] text-gray-500">Dynamic 3D letter block generator</p>
                </div>
            </div>
            
            <div className="space-y-0 flex-grow p-4">
                {/* PRESETS GROUP */}
                <ControlGroup title="Presets" icon={Layout} defaultOpen={false}>
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                                placeholder="New preset name..."
                                className={inputClasses}
                            />
                            <button
                                onClick={() => {
                                    if (newPresetName.trim()) {
                                        onSavePreset(newPresetName);
                                        setNewPresetName('');
                                    }
                                }}
                                disabled={!newPresetName.trim()}
                                className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-[13px] font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                            >
                                Save
                            </button>
                        </div>

                        {presets.length > 0 && (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 clean-scrollbar pt-2">
                                {presets.map((preset) => (
                                    <div key={preset.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200 group transition-all">
                                        <button
                                            onClick={() => onLoadPreset(preset)}
                                            className="text-[13px] font-medium text-gray-700 text-left flex-1"
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
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {presets.length === 0 && (
                            <div className="text-[12px] text-gray-400 text-center py-4 bg-gray-50 border border-dashed border-gray-200 rounded-md">
                                No saved presets
                            </div>
                        )}
                        <div className="pt-2">
                            <button
                                onClick={onResetDefaults}
                                className="w-full py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 text-[11px] font-bold rounded-md shadow-sm transition-colors uppercase tracking-widest border border-gray-200"
                            >
                                Reset App Defaults
                            </button>
                        </div>
                    </div>
                </ControlGroup>

                {/* 1. CONTENT GROUP */}
                <ControlGroup title="Content" icon={Type} defaultOpen={true}>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Main Text</label>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className={`${inputClasses} min-h-[90px] resize-y font-bold`}
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

                <div className="py-2 border-b border-gray-200">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full py-2.5 text-gray-500 hover:text-gray-800 font-semibold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors bg-gray-50 hover:bg-gray-100 rounded-lg"
                    >
                        {showAdvanced ? 'Hide Advanced Controls' : 'Show Advanced Controls'}
                        {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                </div>

                {showAdvanced && (
                    <div className="space-y-0 animate-in fade-in slide-in-from-top-4 duration-300">
                        
                        {/* SUBTITLE SETTINGS */}
                        <ControlGroup title="Subtitle Adjustments" icon={Type} defaultOpen={true}>
                            <div className="space-y-5">
                                <div>
                                    <label className={labelClasses}>Alignment</label>
                                    <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-md">
                                        <button
                                            onClick={() => setSubtitlePos('top')}
                                            className={`px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-all ${subtitlePos === 'top' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Top
                                        </button>
                                        <button
                                            onClick={() => setSubtitlePos('bottom')}
                                            className={`px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-all ${subtitlePos === 'bottom' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
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
                        <ControlGroup title="Animation & Export" icon={Clapperboard} defaultOpen={false}>
                            <div className="space-y-5">
                                <div>
                                    <label className={labelClasses}>Transition Style</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['none', 'pop', 'slide', 'typewriter'].map((preset) => (
                                            <button
                                                key={preset}
                                                onClick={() => setAnimationPreset(preset as SidebarProps['animationPreset'])}
                                                className={twMerge(
                                                    "px-3 py-2 text-[12px] font-medium rounded-md border transition-all capitalize",
                                                    animationPreset === preset
                                                        ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm"
                                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                                                )}
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {animationPreset !== 'none' && (
                                    <>
                                        <button
                                            onClick={onPlayAnimation}
                                            className="w-full px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-md text-[13px] font-medium transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                        >
                                            <Play className="w-3.5 h-3.5" /> Preview Motion
                                        </button>
                                        
                                        <div className="pt-4 border-t border-gray-100">
                                            <button
                                                onClick={onDownloadVideo}
                                                disabled={isExportingVideo}
                                                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[13px] font-medium shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isExportingVideo ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white"></div>
                                                        Rendering {videoProgress}%
                                                    </>
                                                ) : (
                                                    <>
                                                        <Video className="w-3.5 h-3.5" />
                                                        Export WebM (Alpha)
                                                    </>
                                                )}
                                            </button>
                                            <p className="text-[11px] text-gray-500 mt-2 text-center">
                                                Exports transparent WebM video.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </ControlGroup>

                        {/* STYLE GROUP */}
                        <ControlGroup title="Themes & Colors" icon={Palette} defaultOpen={true}>
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className={labelClasses}>Main Tile</label>
                                        <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-gray-200 shadow-sm">
                                            <input type="color" value={tileColor} onChange={(e) => setTileColor(e.target.value)} className="w-6 h-6 rounded clean-color" />
                                            <span className="text-[11px] font-mono text-gray-600 uppercase">{tileColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClasses}>Main Text</label>
                                        <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-gray-200 shadow-sm">
                                            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-6 h-6 rounded clean-color" />
                                            <span className="text-[11px] font-mono text-gray-600 uppercase">{textColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClasses}>Sub Banner</label>
                                        <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-gray-200 shadow-sm">
                                            <input type="color" value={subTileColor} onChange={(e) => setSubTileColor(e.target.value)} className="w-6 h-6 rounded clean-color" />
                                            <span className="text-[11px] font-mono text-gray-600 uppercase">{subTileColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClasses}>Sub Text</label>
                                        <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-gray-200 shadow-sm">
                                            <input type="color" value={subTextColor} onChange={(e) => setSubTextColor(e.target.value)} className="w-6 h-6 rounded clean-color" />
                                            <span className="text-[11px] font-mono text-gray-600 uppercase">{subTextColor}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-[12px] font-semibold text-gray-900">Canvas Preview</label>
                                            <p className="text-[10px] text-gray-500">Background color for testing</p>
                                        </div>
                                        <input type="color" value={canvasBg} onChange={(e) => setCanvasBg(e.target.value)} className="w-6 h-6 rounded clean-color shadow-sm" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-[12px] font-semibold text-gray-900">Dark Backdrop</label>
                                            <p className="text-[10px] text-gray-500">Adds blurred backdrop layer</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={blackBgBlur} onChange={(e) => setBlackBgBlur(e.target.checked)} className="sr-only peer" />
                                            <div className={`toggle-track w-8 h-5 rounded-full peer-focus:outline-none ${blackBgBlur ? 'active' : 'bg-gray-300'}`}>
                                                <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${blackBgBlur ? 'translate-x-[12px]' : ''}`}></div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                
                                <SliderControl label="Global Drop Shadow" value={compositionShadow} onChange={setCompositionShadow} min={0} max={50} step={1} unit="px" />
                            </div>
                        </ControlGroup>

                        {/* LAYOUT GROUP */}
                        <ControlGroup title="Dimensions" icon={Layout}>
                            <div className="space-y-4">
                                <SliderControl label="Scale Factor" value={tileSize} onChange={setTileSize} min={0.5} max={2.5} step={0.1} unit="x" />
                                <SliderControl label="Letter Spacing" value={tileGap} onChange={setTileGap} min={0} max={60} step={1} unit="px" />
                                <SliderControl label="Line Spacing" value={lineGap} onChange={setLineGap} min={0} max={60} step={1} unit="px" />
                                <SliderControl label="Inner Padding" value={tilePadding} onChange={setTilePadding} min={0} max={40} step={1} unit="px" />
                                <SliderControl label="Roundness" value={borderRadius} onChange={setBorderRadius} min={0} max={50} step={1} unit="px" />
                            </div>
                        </ControlGroup>

                        {/* EFFECTS GROUP */}
                        <ControlGroup title="Organic Chaos" icon={Sliders}>
                            <div className="space-y-5">
                                <div className="space-y-3">
                                    <h4 className={labelClasses}>Shadows</h4>
                                    <SliderControl label="Depth Offset" value={shadowOffset} onChange={setShadowOffset} min={0} max={40} step={1} unit="px" />
                                    <SliderControl label="Shadow Variation" value={shadowChaos} onChange={setShadowChaos} min={0} max={10} step={0.5} />
                                </div>

                                <div className="space-y-3">
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

            {/* Actions */}
            <div className="pt-4 mt-2 mt-auto border-t border-gray-200 bg-white grid grid-cols-2 gap-2 px-4 pb-4">
                <button
                    onClick={onDownload}
                    disabled={isDownloading}
                    className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transform active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 text-[13px]"
                >
                    <Download className="w-3.5 h-3.5" /> Export PNG
                </button>
                <button
                    onClick={onDownloadSvg}
                    disabled={isDownloading}
                    className="py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.02)] transform active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 text-[13px]"
                >
                    <Download className="w-3.5 h-3.5" /> Export SVG
                </button>
            </div>

        </div>
    );
}
