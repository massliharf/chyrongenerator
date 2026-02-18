import { useState, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { PreviewArea } from './components/PreviewArea';
import { toPng, toSvg } from 'html-to-image';

function App() {
  const [text, setText] = useState('SCOTT ROGOWSKY');
  const [subtitle, setSubtitle] = useState('BETA MALE');
  // Subtitle Customization
  const [subtitlePos, setSubtitlePos] = useState<'top' | 'bottom'>('bottom');
  const [subtitleSize, setSubtitleSize] = useState(1.25); // rem
  const [subtitlePadding, setSubtitlePadding] = useState({ x: 32, y: 12 }); // px
  const [subtitleRadius, setSubtitleRadius] = useState(999); // px (pill by default)

  // Colors matching the reference image style
  const [tileColor, setTileColor] = useState('#E0F2FE'); // Light blue/white (sky-100)
  const [textColor, setTextColor] = useState('#1F2937'); // Dark gray/black
  const [subTileColor, setSubTileColor] = useState('#F97316'); // Orange (orange-500)
  const [subTextColor, setSubTextColor] = useState('#FFFFFF');

  const [fontFamily, setFontFamily] = useState('Fredoka One');

  const [chaosLevel, setChaosLevel] = useState(5);
  const [tileSize, setTileSize] = useState(1); // Scale factor (0.5 to 2)
  const [tileGap, setTileGap] = useState(12); // px
  // Shadow controls
  const [shadowOffset, setShadowOffset] = useState(8); // px
  const [shadowChaos, setShadowChaos] = useState(0); // 0-10 intensity

  // Advanced styling
  const [borderRadius, setBorderRadius] = useState(12); // px
  const [tilePadding, setTilePadding] = useState(16); // px
  const [canvasBg, setCanvasBg] = useState('#171717'); // hex, default neutral-900

  // Advanced Chaos
  const [scaleChaos, setScaleChaos] = useState(0); // 0-1 intensity factor
  const [posChaos, setPosChaos] = useState(0); // px max offset

  const [isDownloading, setIsDownloading] = useState(false);

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
          onDownload={handleDownload}
          onDownloadSvg={handleDownloadSvg}
          isDownloading={isDownloading}
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
