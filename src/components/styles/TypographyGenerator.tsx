import { useRef, useCallback, forwardRef, useState, useEffect } from 'react';
import { toPng, toSvg } from 'html-to-image';
import { ControlGroup, SliderControl } from '../Sidebar';
import { usePersistentState } from '../../hooks/usePersistentState';
import { Type, Palette, Layout, Download, Sliders, Save, Trash2 } from 'lucide-react';

export type TypographyEffect = 'extrude' | 'skew' | 'offset' | 'outline' | 'retro' | 'glow' | 'neon';

const TypographyPreview = forwardRef<HTMLDivElement, {
    effect: TypographyEffect;
    text: string; subtitle: string; subtitlePos: 'top' | 'bottom';
    subtitleSize: number; subtitlePadding: { x: number, y: number };
    subtitleRadius: number; bannerGap: number;
    fontFamily: string; showBg: boolean; isItalic: boolean;
    textColor: string; effectColor1: string; effectColor2: string;
    bgColor: string; subtitleBg: string; subtitleColor: string;
    value1: number; value2: number; isFilled: boolean;
}>(({ effect, text, subtitle, subtitlePos, subtitleSize, subtitlePadding, subtitleRadius, bannerGap, fontFamily, showBg, isItalic, textColor, effectColor1, effectColor2, bgColor, subtitleBg, subtitleColor, value1, value2, isFilled }, ref) => {
    const lines = text.split('\n');

    const getEffectStyle = (index?: number): React.CSSProperties => {
        const baseStyle: React.CSSProperties = {
            fontFamily,
            fontSize: 'clamp(3rem, 8vw, 7rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            lineHeight: 0.85,
            textAlign: 'center',
            color: textColor,
            fontStyle: isItalic ? 'italic' : 'normal',
        };

        if (effect === 'extrude') {
            const layers = Array.from({ length: value1 }, (_, i) => `${i + 1}px ${i + 1}px 0 ${effectColor1}`).join(', ');
            return { ...baseStyle, textShadow: layers };
        }
        
        if (effect === 'skew') {
            const layers = Array.from({ length: value2 }, (_, i) => `${i + 1}px ${i + 1}px 0 ${effectColor1}`).join(', ');
            return { ...baseStyle, textShadow: layers };
        }
        
        if (effect === 'outline') {
            return {
                ...baseStyle,
                color: isFilled ? effectColor2 : 'transparent',
                WebkitTextStroke: `${value1}px ${effectColor1}`,
            };
        }
        
        if (effect === 'retro') {
            const halfDepth = Math.floor(value1 / 2);
            const shadowStr = `${halfDepth}px ${halfDepth}px 0 ${effectColor1}, ${value1}px ${value1}px 0 ${effectColor2}`;
            return { ...baseStyle, textShadow: shadowStr };
        }

        if (effect === 'glow') {
            return { ...baseStyle, textShadow: `0 0 ${value1}px ${effectColor1}` };
        }

        if (effect === 'neon') {
            return {
                ...baseStyle,
                color: isFilled ? textColor : 'transparent',
                WebkitTextStroke: !isFilled ? `2px ${textColor}` : '0px',
                textShadow: `0 0 5px #fff, 0 0 ${value1}px ${effectColor1}, 0 0 ${value2}px ${effectColor1}, 0 0 ${value2 * 1.5}px ${effectColor2}`,
            };
        }

        return baseStyle; // Default (Offset handled structurally)
    };

    const subtitleElement = subtitle ? (
        <div 
            className="transition-transform duration-200 relative z-10" 
            style={{ 
                transform: effect === 'skew' ? `skewY(${value1}deg)` : 'none',
                marginTop: subtitlePos === 'bottom' ? `${bannerGap}px` : '0px',
                marginBottom: subtitlePos === 'top' ? `${bannerGap}px` : '0px',
            }}
        >
            <div
                className="font-bold uppercase tracking-wider text-center"
                style={{
                    backgroundColor: subtitleBg,
                    color: subtitleColor,
                    fontFamily,
                    fontSize: `${subtitleSize}rem`,
                    padding: `${subtitlePadding.y}px ${subtitlePadding.x}px`,
                    borderRadius: `${subtitleRadius}px`,
                    borderBottom: effect !== 'retro' ? `3px solid color-mix(in srgb, ${subtitleBg}, black 25%)` : 'none',
                    boxShadow: effect === 'retro' ? `${Math.floor(value1 / 2)}px ${Math.floor(value1 / 2)}px 0 color-mix(in srgb, ${subtitleBg}, black 35%)` : 'none',
                    fontStyle: effect === 'skew' ? 'italic' : 'normal'
                }}
            >
                {subtitle}
            </div>
        </div>
    ) : null;

    return (
        <div ref={ref} className="p-16 flex flex-col items-center justify-center relative" style={{ backgroundColor: showBg ? bgColor : 'transparent', minWidth: 600 }}>
            {subtitlePos === 'top' && subtitleElement}
            
            <div
                className="flex flex-col items-center transition-transform duration-200"
                style={{ 
                    transform: effect === 'skew' ? `skewY(${value1}deg)` : 'none',
                    gap: effect === 'outline' ? '4px' : '0px'
                }}
            >
                {lines.map((line, i) => (
                    <div key={i} className="relative">
                        {/* Offset specific shadow layer */}
                        {effect === 'offset' && (
                            <div
                                className="absolute uppercase leading-[0.85] tracking-tight text-center"
                                style={{
                                    fontFamily,
                                    fontSize: 'clamp(3rem, 8vw, 7rem)',
                                    fontWeight: 900,
                                    color: effectColor1,
                                    transform: `translate(${value1}px, ${value2}px)`,
                                    letterSpacing: '-0.02em',
                                    fontStyle: isItalic ? 'italic' : 'normal'
                                }}
                            >
                                {line}
                            </div>
                        )}
                        {/* Main text layer */}
                        <div className="relative z-10" style={getEffectStyle(i)}>
                            {line}
                        </div>
                    </div>
                ))}
            </div>

            {subtitlePos === 'bottom' && subtitleElement}
        </div>
    );
});
TypographyPreview.displayName = 'TypographyPreview';

export interface TypographyPreset {
    id: string;
    name: string;
    timestamp: number;
    effect: TypographyEffect; 
    fontFamily: string; 
    isItalic: boolean;
    text: string;
    subtitle: string;
    subtitlePos: 'top' | 'bottom';
    subtitleSize: number;
    subtitlePadding: { x: number, y: number };
    subtitleRadius: number;
    bannerGap: number;
    textColor: string; 
    effectColor1: string; 
    effectColor2: string;
    bgColor: string;
    subtitleBg: string;
    subtitleColor: string;
    value1: number; 
    value2: number;
    isFilled: boolean;
}

const CONSTANT_PRESETS: Partial<TypographyPreset>[] = [
    { id: 'bold3d', name: 'Bold 3D', effect: 'extrude', fontFamily: 'Ranchers', isItalic: true, textColor: '#FF5722', effectColor1: '#1A1A2E', bgColor: '#03A9F4', value1: 8, value2: 8 },
    { id: 'deepblock', name: 'Deep Block', effect: 'extrude', fontFamily: 'Oswald', isItalic: true, textColor: '#D4E30F', effectColor1: '#1A1A2E', bgColor: '#FF6B6B', value1: 15, value2: 15 },
    { id: 'skarpshadow', name: 'Sharp Shadow', effect: 'extrude', fontFamily: 'Oswald', isItalic: true, textColor: '#03A9F4', effectColor1: '#1A1A2E', bgColor: '#FF5722', value1: 6, value2: 6 },
    { id: 'slantedskew', name: 'Slanted Skew', effect: 'skew', fontFamily: 'Anton', isItalic: true, textColor: '#A78BFA', effectColor1: '#1A1A2E', bgColor: '#D4E30F', value1: -8, value2: 12 },
    { id: 'cleanextrude', name: 'Clean Extrude', effect: 'extrude', fontFamily: 'Oswald', isItalic: false, textColor: '#FF6B6B', effectColor1: '#1A1A2E', bgColor: '#00C853', value1: 12, value2: 12 },
    { id: 'wavydepth', name: 'Wavy Depth', effect: 'extrude', fontFamily: 'Ranchers', isItalic: true, textColor: '#00C853', effectColor1: '#1A1A2E', bgColor: '#A78BFA', value1: 12, value2: 12 },
    { id: 'neonwash', name: 'Neon Wash', effect: 'neon', fontFamily: 'Anton', isItalic: true, textColor: '#FFFFFF', effectColor1: '#FF00FF', effectColor2: '#4100F5', bgColor: '#0A0A0A', value1: 15, value2: 30, isFilled: false }
];

export function TypographyGenerator() {
    const ref = useRef<HTMLDivElement>(null);
    
    // Core Engine
    const [effect, setEffect] = usePersistentState<TypographyEffect>('typo_effect', 'extrude');
    const [text, setText] = usePersistentState('typo_text', 'Scott\nRogowsky');
    const [subtitle, setSubtitle] = usePersistentState('typo_subtitle', 'PUZZLE PAPI');
    const [fontFamily, setFontFamily] = usePersistentState('typo_fontFamily', 'Anton');
    const [showBg, setShowBg] = usePersistentState('typo_showBg', false);
    
    // Subtitle Spatial
    const [subtitlePos, setSubtitlePos] = usePersistentState<'top' | 'bottom'>('typo_subtitlePos', 'bottom');
    const [subtitleSize, setSubtitleSize] = usePersistentState('typo_subtitleSize', 1.4);
    const [subtitlePadding, setSubtitlePadding] = usePersistentState('typo_subtitlePadding', { x: 26, y: 6 });
    const [subtitleRadius, setSubtitleRadius] = usePersistentState('typo_subtitleRadius', 6);
    const [bannerGap, setBannerGap] = usePersistentState('typo_bannerGap', 16);

    // Color State 
    const [textColor, setTextColor] = usePersistentState('typo_textColor', '#FF5722');
    const [effectColor1, setEffectColor1] = usePersistentState('typo_effectColor1', '#1A1A2E');
    const [effectColor2, setEffectColor2] = usePersistentState('typo_effectColor2', '#FF3366');
    const [bgColor, setBgColor] = usePersistentState('typo_bgColor', '#03A9F4');
    const [subtitleBg, setSubtitleBg] = usePersistentState('typo_subtitleBg', '#1A1A2E');
    const [subtitleColor, setSubtitleColor] = usePersistentState('typo_subtitleColor', '#FF5722');

    // Values State
    const [value1, setValue1] = usePersistentState('typo_value1', 8); 
    const [value2, setValue2] = usePersistentState('typo_value2', 8); 
    const [isFilled, setIsFilled] = usePersistentState('typo_isFilled', true);
    const [isItalic, setIsItalic] = usePersistentState('typo_isItalic', true);

    const [isDownloading, setIsDownloading] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
    
    // Presets
    const [presets, setPresets] = usePersistentState<TypographyPreset[]>('typography_presets', []);

    // Deselect active template if user modifies attributes
    useEffect(() => {
        if (!activeTemplate) return;
        const t = CONSTANT_PRESETS.find(p => p.id === activeTemplate);
        if (!t) return;
        
        let matches = true;
        if (t.effect && t.effect !== effect) matches = false;
        if (t.fontFamily && t.fontFamily !== fontFamily) matches = false;
        if (t.isItalic !== undefined && t.isItalic !== isItalic) matches = false;
        if (t.textColor && t.textColor !== textColor) matches = false;
        if (t.effectColor1 && t.effectColor1 !== effectColor1) matches = false;
        if (t.effectColor2 && t.effectColor2 !== effectColor2) matches = false;
        if (t.value1 !== undefined && t.value1 !== value1) matches = false;
        if (t.value2 !== undefined && t.value2 !== value2) matches = false;
        
        if (!matches) setActiveTemplate(null);
    }, [effect, fontFamily, isItalic, textColor, effectColor1, effectColor2, value1, value2, activeTemplate]);

    const FONTS = ["Anton", "Fredoka One", "Bangers", "Oswald", "Inter", "Chewy", "Permanent Marker", "Wicked Mouse", "Ranchers"];

    const getLabels = () => {
        switch (effect) {
            case 'extrude': return { val1: 'Depth', color1: 'Shadow' };
            case 'skew': return { val1: 'Skew Angle', val2: 'Shadow Depth', color1: 'Shadow' };
            case 'offset': return { val1: 'Offset X', val2: 'Offset Y', color1: 'Shadow' };
            case 'outline': return { val1: 'Stroke Width', color1: 'Stroke', color2: 'Fill Color' };
            case 'retro': return { val1: 'Depth', color1: 'Layer 1', color2: 'Layer 2' };
            case 'glow': return { val1: 'Blur Radius', color1: 'Glow Color' };
            case 'neon': return { val1: 'Inner Glow', val2: 'Outer Spread', color1: 'Core Glow', color2: 'Outer Wash'};
            default: return { val1: 'Value', color1: 'Color' };
        }
    };
    const labels = getLabels();

    const handleLoadPreset = (preset: Partial<TypographyPreset>) => {
        if (preset.effect) setEffect(preset.effect);
        if (preset.fontFamily) setFontFamily(preset.fontFamily);
        if (preset.isItalic !== undefined) setIsItalic(preset.isItalic);
        if (preset.textColor) setTextColor(preset.textColor);
        if (preset.effectColor1) setEffectColor1(preset.effectColor1);
        if (preset.effectColor2) setEffectColor2(preset.effectColor2);
        if (preset.bgColor) setBgColor(preset.bgColor);
        if (preset.subtitleBg) setSubtitleBg(preset.subtitleBg);
        if (preset.subtitleColor) setSubtitleColor(preset.subtitleColor);
        if (preset.value1 !== undefined) setValue1(preset.value1);
        if (preset.value2 !== undefined) setValue2(preset.value2);
        if (preset.isFilled !== undefined) setIsFilled(preset.isFilled);
        
        if (preset.id) setActiveTemplate(preset.id);
        
        // Full preset loading
        if (preset.text) setText(preset.text);
        if (preset.subtitle) setSubtitle(preset.subtitle);
        if (preset.subtitlePos) setSubtitlePos(preset.subtitlePos);
        if (preset.subtitleSize) setSubtitleSize(preset.subtitleSize);
        if (preset.subtitlePadding) setSubtitlePadding(preset.subtitlePadding);
        if (preset.subtitleRadius !== undefined) setSubtitleRadius(preset.subtitleRadius);
        if (preset.bannerGap !== undefined) setBannerGap(preset.bannerGap);
    };

    const handleSavePreset = () => {
        if (!newPresetName.trim()) return;
        const newPreset: TypographyPreset = {
            id: crypto.randomUUID(),
            name: newPresetName,
            timestamp: Date.now(),
            effect, fontFamily, isItalic, text, subtitle, subtitlePos,
            subtitleSize, subtitlePadding, subtitleRadius, bannerGap,
            textColor, effectColor1, effectColor2, bgColor, subtitleBg, subtitleColor,
            value1, value2, isFilled
        };
        setPresets([...presets, newPreset]);
        setNewPresetName('');
    };

    const handleDeletePreset = (id: string) => {
        setPresets(presets.filter(p => p.id !== id));
    };

    const handleExport = useCallback(async (format: 'png' | 'svg') => {
        if (!ref.current) return;
        setIsDownloading(true);
        try {
            const fn = format === 'png' ? toPng : toSvg;
            const dataUrl = await fn(ref.current, { cacheBust: true, pixelRatio: 2, style: { backgroundColor: 'transparent' } });
            const a = document.createElement('a');
            a.download = `typo-${Date.now()}.${format}`;
            a.href = dataUrl;
            a.click();
        } catch { alert('Export failed'); }
        finally { setIsDownloading(false); }
    }, []);

    const inputCls = "w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-blue-500 shadow-sm transition-colors";
    const labelCls = "text-[12px] font-semibold text-gray-700 tracking-wide";

    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-white overflow-hidden font-sans">
            {/* Unified Sidebar */}
            <div className="flex-shrink-0 w-full md:w-[360px] h-1/3 md:h-full relative z-20 overflow-y-auto border-r border-gray-200 bg-white custom-scrollbar flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-30 shadow-sm flex items-center justify-between">
                    <div>
                        <h2 className="text-[14px] font-black text-gray-900 tracking-tight uppercase">Typography Engine</h2>
                        <p className="text-[11px] text-gray-500">Full control typographic styler</p>
                    </div>
                </div>

                <div className="flex-1 p-4 space-y-2">
                    
                    {/* PRESETS */}
                    <ControlGroup title="Saved Presets" icon={Save} defaultOpen={false}>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newPresetName}
                                    onChange={(e) => setNewPresetName(e.target.value)}
                                    placeholder="Preset name..."
                                    className={inputCls}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                                />
                                <button
                                    onClick={handleSavePreset}
                                    disabled={!newPresetName.trim()}
                                    className="px-3 bg-blue-600 text-white rounded-md text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    Save
                                </button>
                            </div>
                            {presets.length > 0 && (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {presets.map(preset => (
                                        <div key={preset.id} className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleLoadPreset(preset)}
                                                className="flex-1 text-left px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-[12px] font-semibold text-gray-700 truncate transition-all"
                                            >
                                                {preset.name}
                                            </button>
                                            <button
                                                onClick={() => handleDeletePreset(preset.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                title="Delete preset"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ControlGroup>

                    {/* REFERENCE TYPES */}
                    <ControlGroup title="Reference Templates" icon={Palette} defaultOpen={true}>
                        <div className="grid grid-cols-3 gap-2">
                            {CONSTANT_PRESETS.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => handleLoadPreset(preset)}
                                    className={`py-1.5 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                        activeTemplate === preset.id 
                                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-md' 
                                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                                    }`}
                                >
                                    {preset.name}
                                </button>
                            ))}
                        </div>
                    </ControlGroup>

                    {/* CONTENT */}
                    <ControlGroup title="Content" icon={Type} defaultOpen={true}>
                        <div className="space-y-4">
                            <div>
                                <label className={labelCls}>Main Text</label>
                                <textarea value={text} onChange={e => setText(e.target.value)} className={`${inputCls} min-h-[90px] resize-y font-bold mt-1.5`} />
                            </div>
                            <div>
                                <label className={labelCls}>Font Family</label>
                                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className={`${inputCls} mt-1.5`}>
                                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={isItalic} onChange={(e) => setIsItalic(e.target.checked)} className="sr-only peer" />
                                    <div className={`w-8 h-5 rounded-full peer-focus:outline-none ${isItalic ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                        <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${isItalic ? 'translate-x-[12px]' : ''}`}></div>
                                    </div>
                                </label>
                                <span className={labelCls}>Italicize Text</span>
                            </div>
                            <hr className="border-gray-100" />
                            <div>
                                <label className={labelCls}>Subtitle</label>
                                <input value={subtitle} onChange={e => setSubtitle(e.target.value)} className={`${inputCls} mt-1.5`} />
                            </div>
                        </div>
                    </ControlGroup>

                    {/* EFFECT ENGINE */}
                    <ControlGroup title="Effect Engine" icon={Sliders} defaultOpen={true}>
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {(['extrude', 'skew', 'offset', 'outline', 'retro', 'glow', 'neon'] as TypographyEffect[]).map(eff => (
                                    <button
                                        key={eff}
                                        onClick={() => setEffect(eff)}
                                        className={`py-1.5 px-2 rounded-md text-[11px] font-bold capitalize border transition-all ${
                                            effect === eff 
                                                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' 
                                                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                                        }`}
                                    >
                                        {eff}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                <SliderControl 
                                    label={labels.val1} 
                                    value={value1} 
                                    onChange={setValue1} 
                                    min={effect === 'skew' ? -15 : 1} 
                                    max={effect === 'outline' ? 8 : effect === 'skew' ? 15 : effect === 'glow' ? 100 : 30} 
                                    step={effect === 'outline' ? 0.5 : 1}
                                />
                                {labels.val2 && (
                                    <SliderControl 
                                        label={labels.val2} 
                                        value={value2} 
                                        onChange={setValue2} 
                                        min={effect === 'offset' ? -20 : 2} 
                                        max={effect === 'offset' ? 20 : effect === 'neon' ? 100 : 30} 
                                        step={1}
                                    />
                                )}
                                {(effect === 'outline' || effect === 'neon') && (
                                    <div className="flex items-center justify-between pt-2">
                                        <label className={labelCls}>Fill Main Text</label>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={isFilled} onChange={(e) => setIsFilled(e.target.checked)} className="sr-only peer" />
                                            <div className={`w-8 h-5 rounded-full peer-focus:outline-none ${isFilled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                                <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${isFilled ? 'translate-x-[12px]' : ''}`}></div>
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ControlGroup>

                    {/* STYLING & COLORS */}
                    <ControlGroup title="Styling & Colors" icon={Palette} defaultOpen={false}>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                {effect !== 'outline' && (
                                    <div className="space-y-1">
                                        <label className={labelCls}>Main Text</label>
                                        <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className={labelCls}>{labels.color1}</label>
                                    <input type="color" value={effectColor1} onChange={e => setEffectColor1(e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                                </div>
                                {labels.color2 && (
                                    <div className="space-y-1">
                                        <label className={labelCls}>{labels.color2}</label>
                                        <input type="color" value={effectColor2} onChange={e => setEffectColor2(e.target.value)} disabled={effect === 'outline' && !isFilled} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                                    </div>
                                )}
                            </div>

                            <hr className="border-gray-100" />
                            
                            <div className="space-y-3">
                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Subtitle</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className={labelCls}>Background</label>
                                        <input type="color" value={subtitleBg} onChange={e => setSubtitleBg(e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelCls}>Text</label>
                                        <input type="color" value={subtitleColor} onChange={e => setSubtitleColor(e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ControlGroup>

                    {/* SUBTITLE SPATIAL */}
                    <ControlGroup title="Subtitle Adjustments" icon={Layout} defaultOpen={false}>
                        <div className="space-y-5">
                            <div>
                                <label className={labelCls}>Alignment</label>
                                <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-md mt-1.5">
                                    <button onClick={() => setSubtitlePos('top')} className={`px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-all ${subtitlePos === 'top' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500'}`}>Top</button>
                                    <button onClick={() => setSubtitlePos('bottom')} className={`px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-all ${subtitlePos === 'bottom' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500'}`}>Bottom</button>
                                </div>
                            </div>
                            <SliderControl label="Scale" value={subtitleSize} onChange={setSubtitleSize} min={0.5} max={4} step={0.1} unit="rem" />
                            <SliderControl label="Horizontal Padding" value={subtitlePadding.x} onChange={(v) => setSubtitlePadding({ ...subtitlePadding, x: v })} min={0} max={60} step={2} unit="px" />
                            <SliderControl label="Vertical Padding" value={subtitlePadding.y} onChange={(v) => setSubtitlePadding({ ...subtitlePadding, y: v })} min={0} max={40} step={2} unit="px" />
                            <SliderControl label="Border Roundness" value={subtitleRadius} onChange={setSubtitleRadius} min={0} max={100} step={2} unit="px" />
                            <SliderControl label="Banner Gap" value={bannerGap} onChange={setBannerGap} min={0} max={100} step={4} unit="px" />
                        </div>
                    </ControlGroup>

                </div>

                {/* Footer Actions */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
                    <div className="flex items-center justify-between mb-3 border border-gray-200 rounded-md p-2 bg-gray-50">
                        <label className={labelCls}>Canvas Background</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} disabled={!showBg} className="w-5 h-5 rounded cursor-pointer border" />
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={showBg} onChange={(e) => setShowBg(e.target.checked)} className="sr-only peer" />
                                <div className={`w-7 h-4 rounded-full peer-focus:outline-none ${showBg ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                    <div className={`absolute top-[2px] left-[2px] w-3 h-3 bg-white rounded-full transition-transform ${showBg ? 'translate-x-[12px]' : ''}`}></div>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleExport('png')} disabled={isDownloading} className="py-2.5 bg-blue-600 text-white font-medium rounded-md shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 text-[13px] transition-all">
                            <Download className="w-3.5 h-3.5" /> PNG
                        </button>
                        <button onClick={() => handleExport('svg')} disabled={isDownloading} className="py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-md shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 text-[13px] transition-all">
                            <Download className="w-3.5 h-3.5" /> SVG
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Output */}
            <div className={`flex-1 flex items-center justify-center p-8 overflow-auto ${showBg ? 'bg-neutral-900 border-l border-neutral-800' : 'checkerboard-bg border-l border-gray-200'}`}>
                <TypographyPreview 
                    ref={ref} 
                    effect={effect}
                    text={text} subtitle={subtitle} subtitlePos={subtitlePos} 
                    subtitleSize={subtitleSize} subtitlePadding={subtitlePadding} subtitleRadius={subtitleRadius} bannerGap={bannerGap}
                    fontFamily={fontFamily} showBg={showBg} isItalic={isItalic}
                    textColor={textColor} effectColor1={effectColor1} effectColor2={effectColor2} 
                    bgColor={bgColor} subtitleBg={subtitleBg} subtitleColor={subtitleColor}
                    value1={value1} value2={value2} isFilled={isFilled}
                />
            </div>
        </div>
    );
}
