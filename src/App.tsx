import { useState, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { PreviewArea } from './components/PreviewArea';
import { toPng, toSvg, toCanvas } from 'html-to-image';
import { usePersistentState } from './hooks/usePersistentState';
import { TypographyGenerator } from './components/styles/TypographyGenerator';
import { MaterialIcon } from './components/MaterialIcon';

export type AnimationPreset =
  | 'none'
  | 'pop'
  | 'slide'
  | 'typewriter'
  | 'bounce'
  | 'flip'
  | 'wave'
  | 'elastic'
  | 'glitch'
  | 'zoom'
  | 'spin'
  | 'cascade'
  | 'shutter'
  | 'swing'
  | 'drift'
  | 'pulse';

type ChyronMode = 'tiles' | 'typography';
const MODES: { id: ChyronMode; label: string }[] = [
  { id: 'tiles', label: 'Tiles Mode' },
  { id: 'typography', label: 'Typography Mode' },
];

export interface Preset {
  id: string;
  name: string;
  timestamp: number;
  text: string;
  subtitle: string;
  subtitlePos: 'top' | 'bottom';
  subtitleSize: number;
  subtitlePadding: { x: number, y: number };
  subtitleRadius: number;
  bannerGap: number;
  tileColor: string;
  textColor: string;
  subTileColor: string;
  subTextColor: string;
  fontFamily: string;
  chaosLevel: number;
  tileSize: number;
  tileGap: number;
  lineGap: number;
  shadowOffset: number;
  shadowChaos: number;
  borderRadius: number;
  tilePadding: number;
  canvasBg: string;
  blackBgBlur: boolean;
  scaleChaos: number;
  posChaos: number;
  compositionShadow: number;
  animationPreset: AnimationPreset;
  animationDuration: number;
}

function App() {
  const [chyronMode, setChyronMode] = useState<ChyronMode>('tiles');
  const [text, setText] = usePersistentState('text', 'Scott\nRogowsky');
  const [subtitle, setSubtitle] = usePersistentState('subtitle', 'PUZZLE PAPI');

  // Subtitle Customization
  const [subtitlePos, setSubtitlePos] = usePersistentState<'top' | 'bottom'>('subtitlePos', 'bottom');
  const [subtitleSize, setSubtitleSize] = usePersistentState('subtitleSize', 2); // rem
  const [subtitlePadding, setSubtitlePadding] = usePersistentState('subtitlePadding', { x: 26, y: 6 }); // px
  const [subtitleRadius, setSubtitleRadius] = usePersistentState('subtitleRadius', 12); // px
  const [bannerGap, setBannerGap] = usePersistentState('bannerGap', 32); // px

  // Colors matching the reference image style
  const [tileColor, setTileColor] = usePersistentState('tileColor', '#CCE1FF');
  const [textColor, setTextColor] = usePersistentState('textColor', '#001533');
  const [subTileColor, setSubTileColor] = usePersistentState('subTileColor', '#006AFF');
  const [subTextColor, setSubTextColor] = usePersistentState('subTextColor', '#FFFFFF');

  const [fontFamily, setFontFamily] = usePersistentState('fontFamily', 'Wicked Mouse');

  const [chaosLevel, setChaosLevel] = usePersistentState('chaosLevel', 5);
  const [tileSize, setTileSize] = usePersistentState('tileSize', 1.4); // Scale factor (0.5 to 2)
  const [tileGap, setTileGap] = usePersistentState('tileGap', 8); // px
  const [lineGap, setLineGap] = usePersistentState('lineGap', 8); // px
  // Shadow controls
  const [shadowOffset, setShadowOffset] = usePersistentState('shadowOffset', 4); // px
  const [shadowChaos, setShadowChaos] = usePersistentState('shadowChaos', 0); // 0-10 intensity

  // Advanced styling
  const [borderRadius, setBorderRadius] = usePersistentState('borderRadius', 16); // px
  const [tilePadding, setTilePadding] = usePersistentState('tilePadding', 16); // px
  const [canvasBg, setCanvasBg] = usePersistentState('canvasBg', '#171717'); // hex
  const [blackBgBlur, setBlackBgBlur] = usePersistentState('blackBgBlur', false); // boolean

  // Advanced Chaos
  const [scaleChaos, setScaleChaos] = usePersistentState('scaleChaos', 0); // 0-1 intensity factor
  const [posChaos, setPosChaos] = usePersistentState('posChaos', 0); // px max offset

  // Global Effects
  const [compositionShadow, setCompositionShadow] = usePersistentState('compositionShadow', 0); // px blur/spread for global drop-shadow

  // Animation
  const [animationPreset, setAnimationPreset] = usePersistentState<AnimationPreset>('animationPreset', 'none');
  const [animationDuration, setAnimationDuration] = usePersistentState('animationDuration', 2); // seconds
  const [animationProgress, setAnimationProgress] = useState(1); // 1 = complete (default state)

  // Export Settings
  const [exportWidth, setExportWidth] = usePersistentState('exportWidth', 1920);
  const [exportHeight, setExportHeight] = usePersistentState('exportHeight', 1080);
  const [useCustomExportSize, setUseCustomExportSize] = usePersistentState('useCustomExportSize', false);
  const [includeBackground, setIncludeBackground] = usePersistentState('includeBackground', false);
  const [exportAlignment, setExportAlignment] = usePersistentState<'center' | 'bottom' | 'top'>('exportAlignment', 'center');
  const [compositionScale, setCompositionScale] = usePersistentState('compositionScale', 1.0);
  const [exportPosX, setExportPosX] = usePersistentState('exportPosX', 0);
  const [exportPosY, setExportPosY] = usePersistentState('exportPosY', 0);
  const [enableSnapping, setEnableSnapping] = usePersistentState('enableSnapping', true);

  const [presets, setPresets] = usePersistentState<Preset[]>('presets', []);

  const handleSavePreset = (name: string) => {
    const newPreset: Preset = {
      id: crypto.randomUUID(),
      name,
      timestamp: Date.now(),
      text, subtitle, subtitlePos, subtitleSize, subtitlePadding, subtitleRadius, bannerGap,
      tileColor, textColor, subTileColor, subTextColor, fontFamily,
      chaosLevel, tileSize, tileGap, lineGap, shadowOffset, shadowChaos,
      borderRadius, tilePadding, canvasBg, blackBgBlur, scaleChaos, posChaos,
      compositionShadow, animationPreset, animationDuration
    };
    setPresets([...presets, newPreset]);
  };

  const handleLoadPreset = (preset: Preset) => {
    setText(preset.text);
    setSubtitle(preset.subtitle);
    setSubtitlePos(preset.subtitlePos);
    setSubtitleSize(preset.subtitleSize);
    setSubtitlePadding(preset.subtitlePadding);
    setSubtitleRadius(preset.subtitleRadius);
    setBannerGap(preset.bannerGap);
    setTileColor(preset.tileColor);
    setTextColor(preset.textColor);
    setSubTileColor(preset.subTileColor);
    setSubTextColor(preset.subTextColor);
    setFontFamily(preset.fontFamily);
    setChaosLevel(preset.chaosLevel);
    setTileSize(preset.tileSize);
    setTileGap(preset.tileGap);
    setLineGap(preset.lineGap ?? preset.tileGap ?? 16); // Fallback for old presets
    setShadowOffset(preset.shadowOffset);
    setShadowChaos(preset.shadowChaos);
    setBorderRadius(preset.borderRadius);
    setTilePadding(preset.tilePadding);
    setCanvasBg(preset.canvasBg);
    setBlackBgBlur(preset.blackBgBlur);
    setScaleChaos(preset.scaleChaos);
    setPosChaos(preset.posChaos);
    setCompositionShadow(preset.compositionShadow ?? 0);
    setAnimationPreset(preset.animationPreset ?? 'none');
    setAnimationDuration(preset.animationDuration ?? 2);
  };

  const handleDeletePreset = (id: string) => {
    setPresets(presets.filter(p => p.id !== id));
  };

  const handleResetDefaults = () => {
    setTileColor('#CCE1FF');
    setTextColor('#001533');
    setSubTileColor('#006AFF');
    setSubTextColor('#FFFFFF');
    setFontFamily('Wicked Mouse');
    setSubtitlePos('bottom');
    setSubtitleSize(2);
    setSubtitlePadding({ x: 26, y: 6 });
    setSubtitleRadius(12);
    setBannerGap(32);
    setChaosLevel(5);
    setTileSize(1.4);
    setTileGap(8);
    setLineGap(8);
    setShadowOffset(4);
    setShadowChaos(0);
    setBorderRadius(16);
    setTilePadding(16);
    setCanvasBg('#171717');
    setBlackBgBlur(false);
    setScaleChaos(0);
    setPosChaos(0);
    setCompositionShadow(0);
    setAnimationPreset('none');
    setAnimationDuration(2);
    setCompositionScale(1.0);
    setExportPosX(0);
    setExportPosY(0);
    setExportAlignment('center');
  };

  const handlePlayAnimation = () => {
    if (animationPreset === 'none') return;

    // Animate from 0 to 1 over duration
    const startTime = performance.now();
    const durationMs = animationDuration * 1000;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      setAnimationProgress(progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  const handleDownloadVideo = async () => {
    if (!previewRef.current || animationPreset === 'none') return;

    setIsExportingVideo(true);
    setVideoProgress(0);

    try {
      // Dynamic import for webm-writer to avoid SSR/build issues if it's not friendly
      // But we are in Vite, so import should work. 
      // If imports fail, we might need a script tag or simple hack.
      // Assuming user installed webm-writer. 
      // Since we don't have types working perfectly, use any.
      const WebMWriter = (await import('webm-writer')).default;

      const fps = 30;
      const durationMs = animationDuration * 1000;
      const totalFrames = Math.ceil((durationMs / 1000) * fps);

      const videoWriter = new WebMWriter({
        quality: 0.95,
        frameRate: fps,
        transparent: true // Alpha channel support!
      });

      const node = previewRef.current;

      // Loop through frames
      for (let i = 0; i <= totalFrames; i++) {
        const progress = i / totalFrames;
        setAnimationProgress(progress);
        setVideoProgress(Math.round(progress * 100));

        // Wait for React to render the new state
        await new Promise(resolve => setTimeout(resolve, 50));

        // Capture frame with proper alpha channel and no squeezing
        const canvasOpts: Record<string, unknown> = {
          cacheBust: true,
          filter: (domNode: HTMLElement) => !domNode.classList?.contains('export-ignore'),
          style: {
            transform: 'none',
            backgroundColor: includeBackground ? canvasBg : 'transparent',
          }
        };
        if (useCustomExportSize) {
          canvasOpts.pixelRatio = 1;
          canvasOpts.width = exportWidth;
          canvasOpts.height = exportHeight;
          canvasOpts.canvasWidth = exportWidth;
          canvasOpts.canvasHeight = exportHeight;
        } else {
          canvasOpts.pixelRatio = 2;
        }
        const canvas = await toCanvas(node, canvasOpts);

        videoWriter.addFrame(canvas);
      }

      const blob = await videoWriter.complete();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `chyron-${Date.now()}.webm`;
      link.href = url;
      link.click();

    } catch (err) {
      console.error('Video export failed', err);
      alert('Video export failed. See console.');
    } finally {
      setIsExportingVideo(false);
      setAnimationProgress(1); // Reset to full visibility
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const previewRef = useRef<HTMLDivElement>(null);

  const getExportOptions = () => {
    if (useCustomExportSize && previewRef.current) {
      return {
        cacheBust: true,
        pixelRatio: 1,
        width: exportWidth,
        height: exportHeight,
        canvasWidth: exportWidth,
        canvasHeight: exportHeight,
        filter: (domNode: HTMLElement) => !domNode.classList?.contains('export-ignore'),
        style: {
          transform: 'none',
          backgroundColor: includeBackground ? canvasBg : 'transparent',
        },
      };
    } else {
      return {
        cacheBust: true,
        pixelRatio: 2,
        filter: (domNode: HTMLElement) => !domNode.classList?.contains('export-ignore'),
        style: {
          backgroundColor: includeBackground ? canvasBg : 'transparent',
        },
      };
    }
  };

  const handleDownload = useCallback(async () => {
    if (previewRef.current === null) {
      return;
    }

    setIsDownloading(true);

    try {
      const opts = getExportOptions();
      const dataUrl = await toPng(previewRef.current, opts);
      const link = document.createElement('a');
      link.download = `chyron-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image', err);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [previewRef, useCustomExportSize, exportWidth, exportHeight, includeBackground, canvasBg]);

  const handleDownloadSvg = useCallback(async () => {
    if (previewRef.current === null) return;
    setIsDownloading(true);
    try {
      const opts = getExportOptions();
      const dataUrl = await toSvg(previewRef.current, opts);
      const link = document.createElement('a');
      link.download = `chyron-${Date.now()}.svg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate SVG', err);
      alert('Failed to generate SVG.');
    } finally {
      setIsDownloading(false);
    }
  }, [previewRef, useCustomExportSize, exportWidth, exportHeight, includeBackground, canvasBg]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#fafaf9] overflow-hidden font-sans">
      {/* ── Notion Header Navigation with Material Design Icons ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-white border-b border-[#e5e3df] z-30">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-[#5645d4] flex items-center justify-center text-white shadow-xs select-none">
            <MaterialIcon name="tv" className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="font-semibold text-[#1a1a1a]">Chyron Studio</span>
            <span className="text-[#a4a097]">/</span>
            <span className="text-[#787671] hidden sm:inline">Broadcast Graphics</span>
            <span className="notion-tag notion-tag-purple ml-1">Workspace</span>
          </div>
        </div>

        {/* Mode Switcher (Notion Pill-Tabs with Material Design Icons) */}
        <div className="flex items-center gap-1 bg-[#f6f5f4] p-1 rounded-full border border-[#e5e3df]">
          {MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setChyronMode(mode.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
                chyronMode === mode.id
                  ? 'bg-[#1a1a1a] text-white shadow-xs'
                  : 'text-[#787671] hover:text-[#1a1a1a] hover:bg-white/60'
              }`}
            >
              <MaterialIcon name={mode.id === 'tiles' ? 'grid_view' : 'text_fields'} className="w-3.5 h-3.5" />
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Right Action: Signature Notion Purple CTA with Material Download Icon */}
        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex notion-tag notion-tag-mint items-center gap-1">
            <MaterialIcon name="check_circle" className="w-3 h-3 text-[#1aae39]" />
            Alpha Active
          </span>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="notion-btn notion-btn-primary text-[13px] py-1.5 px-3.5 shadow-xs gap-1.5"
          >
            <MaterialIcon name="download" className="w-3.5 h-3.5" />
            Export PNG
          </button>
        </div>
      </header>

      {/* ── Content Area ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {chyronMode === 'tiles' ? (
          <>
            {/* Existing Tile Generator — ZERO CHANGES */}
            <div className="flex-shrink-0 w-full md:w-auto h-1/3 md:h-full relative z-20 overflow-y-auto md:overflow-visible">
              <Sidebar
                text={text}
                setText={setText}
                subtitle={subtitle}
                setSubtitle={setSubtitle}
                subtitlePos={subtitlePos}
                setSubtitlePos={setSubtitlePos}
                subtitleSize={subtitleSize}
                setSubtitleSize={setSubtitleSize}
                subtitlePadding={subtitlePadding}
                setSubtitlePadding={setSubtitlePadding}
                subtitleRadius={subtitleRadius}
                setSubtitleRadius={setSubtitleRadius}
                tileColor={tileColor}
                setTileColor={setTileColor}
                textColor={textColor}
                setTextColor={setTextColor}
                subTileColor={subTileColor}
                setSubTileColor={setSubTileColor}
                subTextColor={subTextColor}
                setSubTextColor={setSubTextColor}
                fontFamily={fontFamily}
                setFontFamily={setFontFamily}
                chaosLevel={chaosLevel}
                setChaosLevel={setChaosLevel}
                tileSize={tileSize}
                setTileSize={setTileSize}
                tileGap={tileGap}
                setTileGap={setTileGap}
                lineGap={lineGap}
                setLineGap={setLineGap}
                shadowOffset={shadowOffset}
                setShadowOffset={setShadowOffset}
                shadowChaos={shadowChaos}
                setShadowChaos={setShadowChaos}
                borderRadius={borderRadius}
                setBorderRadius={setBorderRadius}
                tilePadding={tilePadding}
                setTilePadding={setTilePadding}
                canvasBg={canvasBg}
                setCanvasBg={setCanvasBg}
                scaleChaos={scaleChaos}
                setScaleChaos={setScaleChaos}
                posChaos={posChaos}
                setPosChaos={setPosChaos}
                bannerGap={Number(bannerGap)}
                setBannerGap={setBannerGap}
                blackBgBlur={blackBgBlur}
                setBlackBgBlur={setBlackBgBlur}
                compositionShadow={compositionShadow}
                setCompositionShadow={setCompositionShadow}
                presets={presets}
                onSavePreset={handleSavePreset}
                onLoadPreset={handleLoadPreset}
                onDeletePreset={handleDeletePreset}
                onResetDefaults={handleResetDefaults}
                onDownload={handleDownload}
                onDownloadSvg={handleDownloadSvg}
                onDownloadVideo={handleDownloadVideo}
                isDownloading={isDownloading}
                isExportingVideo={isExportingVideo}
                videoProgress={videoProgress}
                animationPreset={animationPreset}
                setAnimationPreset={setAnimationPreset}
                animationDuration={animationDuration}
                setAnimationDuration={setAnimationDuration}
                onPlayAnimation={handlePlayAnimation}
                exportWidth={exportWidth}
                setExportWidth={setExportWidth}
                exportHeight={exportHeight}
                setExportHeight={setExportHeight}
                useCustomExportSize={useCustomExportSize}
                setUseCustomExportSize={setUseCustomExportSize}
                includeBackground={includeBackground}
                setIncludeBackground={setIncludeBackground}
                exportAlignment={exportAlignment}
                setExportAlignment={setExportAlignment}
                compositionScale={compositionScale}
                setCompositionScale={setCompositionScale}
                exportPosX={exportPosX}
                setExportPosX={setExportPosX}
                exportPosY={exportPosY}
                setExportPosY={setExportPosY}
                enableSnapping={enableSnapping}
                setEnableSnapping={setEnableSnapping}
              />
            </div>
            <div className="flex-grow relative z-10 bg-[#f6f5f4] border-l border-[#e5e3df]">
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                <PreviewArea
                  ref={previewRef}
                  text={text}
                  subtitle={subtitle}
                  subtitlePos={subtitlePos}
                  subtitleSize={subtitleSize}
                  subtitlePadding={subtitlePadding}
                  subtitleRadius={subtitleRadius}
                  tileColor={tileColor}
                  textColor={textColor}
                  subTileColor={subTileColor}
                  subTextColor={subTextColor}
                  fontFamily={fontFamily}
                  chaosLevel={chaosLevel}
                  tileSize={tileSize}
                  tileGap={tileGap}
                  lineGap={lineGap}
                  shadowOffset={shadowOffset}
                  shadowChaos={shadowChaos}
                  borderRadius={borderRadius}
                  tilePadding={tilePadding}
                  canvasBg={canvasBg}
                  scaleChaos={scaleChaos}
                  posChaos={posChaos}
                  bannerGap={Number(bannerGap)}
                  blackBgBlur={blackBgBlur}
                  compositionShadow={compositionShadow}
                  animationProgress={animationProgress}
                  animationPreset={animationPreset}
                  exportWidth={exportWidth}
                  exportHeight={exportHeight}
                  useCustomExportSize={useCustomExportSize}
                  includeBackground={includeBackground}
                  exportAlignment={exportAlignment}
                  compositionScale={compositionScale}
                  setCompositionScale={setCompositionScale}
                  exportPosX={exportPosX}
                  exportPosY={exportPosY}
                  onPositionChange={(x, y) => {
                    setExportPosX(x);
                    setExportPosY(y);
                  }}
                  enableSnapping={enableSnapping}
                  isExporting={isDownloading || isExportingVideo}
                />
              </div>
            </div>
          </>
        ) : chyronMode === 'typography' ? (
          <TypographyGenerator />
        ) : null}
      </div>
    </div>
  );
}

export default App;
