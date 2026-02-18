import { useState, useRef, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { PreviewArea } from './components/PreviewArea';
import { toPng, toSvg, toCanvas } from 'html-to-image';
import { usePersistentState } from './hooks/usePersistentState';

function App() {
  const [text, setText] = usePersistentState('text', 'Scott\nRogowsky');
  const [subtitle, setSubtitle] = usePersistentState('subtitle', 'PUZZLE PAPI');

  // Subtitle Customization
  const [subtitlePos, setSubtitlePos] = usePersistentState<'top' | 'bottom'>('subtitlePos', 'bottom');
  const [subtitleSize, setSubtitleSize] = usePersistentState('subtitleSize', 2.4); // rem
  const [subtitlePadding, setSubtitlePadding] = usePersistentState('subtitlePadding', { x: 26, y: 6 }); // px
  const [subtitleRadius, setSubtitleRadius] = usePersistentState('subtitleRadius', 12); // px
  const [bannerGap, setBannerGap] = usePersistentState('bannerGap', 32); // px

  // Colors matching the reference image style
  const [tileColor, setTileColor] = usePersistentState('tileColor', '#E0F2FE'); // Light blue/white (sky-100)
  const [textColor, setTextColor] = usePersistentState('textColor', '#1F2937'); // Dark gray/black
  const [subTileColor, setSubTileColor] = usePersistentState('subTileColor', '#F97316'); // Orange (orange-500)
  const [subTextColor, setSubTextColor] = usePersistentState('subTextColor', '#FFFFFF');

  const [fontFamily, setFontFamily] = usePersistentState('fontFamily', 'Fredoka One');

  const [chaosLevel, setChaosLevel] = usePersistentState('chaosLevel', 5);
  const [tileSize, setTileSize] = usePersistentState('tileSize', 1); // Scale factor (0.5 to 2)
  const [tileGap, setTileGap] = usePersistentState('tileGap', 12); // px
  // Shadow controls
  const [shadowOffset, setShadowOffset] = usePersistentState('shadowOffset', 6); // px
  const [shadowChaos, setShadowChaos] = usePersistentState('shadowChaos', 0); // 0-10 intensity

  // Advanced styling
  const [borderRadius, setBorderRadius] = usePersistentState('borderRadius', 12); // px
  const [tilePadding, setTilePadding] = usePersistentState('tilePadding', 16); // px
  const [canvasBg, setCanvasBg] = usePersistentState('canvasBg', '#171717'); // hex
  const [blackBgBlur, setBlackBgBlur] = usePersistentState('blackBgBlur', false); // boolean

  // Advanced Chaos
  const [scaleChaos, setScaleChaos] = usePersistentState('scaleChaos', 0); // 0-1 intensity factor
  const [posChaos, setPosChaos] = usePersistentState('posChaos', 0); // px max offset

  // Global Effects
  const [compositionShadow, setCompositionShadow] = usePersistentState('compositionShadow', 0); // px blur/spread for global drop-shadow

  // Animation
  const [animationPreset, setAnimationPreset] = usePersistentState<'none' | 'pop' | 'slide' | 'typewriter'>('animationPreset', 'none');
  const [animationDuration, setAnimationDuration] = usePersistentState('animationDuration', 2); // seconds
  const [animationProgress, setAnimationProgress] = useState(1); // 1 = complete (default state)

  // Presets
  interface Preset {
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
    shadowOffset: number;
    shadowChaos: number;
    borderRadius: number;
    tilePadding: number;
    canvasBg: string;
    blackBgBlur: boolean;
    scaleChaos: number;
    posChaos: number;
    compositionShadow: number;
    animationPreset: 'none' | 'pop' | 'slide' | 'typewriter';
    animationDuration: number;
  }

  const [presets, setPresets] = usePersistentState<Preset[]>('presets', []);

  const handleSavePreset = (name: string) => {
    const newPreset: Preset = {
      id: crypto.randomUUID(),
      name,
      timestamp: Date.now(),
      text, subtitle, subtitlePos, subtitleSize, subtitlePadding, subtitleRadius, bannerGap,
      tileColor, textColor, subTileColor, subTextColor, fontFamily,
      chaosLevel, tileSize, tileGap, shadowOffset, shadowChaos,
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

        // Capture frame
        // Note: We use toCanvas to get a canvas element (transparent)
        const canvas = await toCanvas(node, {
          backgroundColor: null as any, // Transparent
          style: {
            transform: 'scale(1)', // Ensure no unintended scaling
          }
        });

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

  const handleDownload = useCallback(async () => {
    if (previewRef.current === null) {
      return;
    }

    setIsDownloading(true);

    try {
      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        style: { backgroundColor: 'transparent' }
      });
      const link = document.createElement('a');
      link.download = 'tile-text.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image', err);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [previewRef]);

  const handleDownloadSvg = useCallback(async () => {
    if (previewRef.current === null) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toSvg(previewRef.current, {
        cacheBust: true,
        style: { backgroundColor: 'transparent' }
      });
      const link = document.createElement('a');
      link.download = 'tile-text.svg';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate SVG', err);
      alert('Failed to generate SVG.');
    } finally {
      setIsDownloading(false);
    }
  }, [previewRef]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-white overflow-hidden font-sans">
      {/* Sidebar */}
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
          onDownload={handleDownload}
          onDownloadSvg={handleDownloadSvg}
          onDownloadVideo={handleDownloadVideo}
          isDownloading={isDownloading}
          isExportingVideo={isExportingVideo}
          videoProgress={videoProgress}
          animationPreset={animationPreset}
          setAnimationPreset={setAnimationPreset}
          onPlayAnimation={handlePlayAnimation}
        />
      </div>

      {/* Main Preview Area */}
      <div className="flex-grow relative z-10 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-neutral-900 border-l border-neutral-800">
        <div className="absolute inset-0 flex items-center justify-center overflow-auto">
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
          />
        </div>

        {/* Background Hint or Overlay if needed */}
        <div className="absolute bottom-4 right-4 text-neutral-600 text-xs pointer-events-none select-none">
          Preview checks
        </div>
      </div>
    </div>
  );
}

export default App;
