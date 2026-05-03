import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppStore, type ImageRecord } from '../../stores/app-store';
import { api } from '../../lib/ipc';

type Phase = 'measure' | 'initial' | 'animating' | 'done' | 'exit-start' | 'exiting';

export function ImageFocus() {
  const { selectedImageId, setSelectedImage, focusOriginRect, setClosingFocus } = useAppStore();
  const [image, setImage] = useState<ImageRecord | null>(null);
  const [phase, setPhase] = useState<Phase>('measure');
  const containerRef = useRef<HTMLDivElement>(null);
  const [targetRect, setTargetRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (selectedImageId) {
      api.getImage(selectedImageId).then(setImage);
    }
  }, [selectedImageId]);

  useLayoutEffect(() => {
    if (!image || phase !== 'measure') return;
    if (containerRef.current && focusOriginRect && image.width && image.height) {
      const container = containerRef.current.getBoundingClientRect();
      const padding = 16;
      const availW = container.width - padding * 2;
      const availH = container.height - padding * 2;
      const scale = Math.min(availW / image.width, availH / image.height, 1);
      const imgW = image.width * scale;
      const imgH = image.height * scale;
      const imgX = container.x + (container.width - imgW) / 2;
      const imgY = container.y + (container.height - imgH) / 2;
      setTargetRect({ x: imgX, y: imgY, width: imgW, height: imgH });
      setPhase('initial');
    } else if (containerRef.current && focusOriginRect) {
      const rect = containerRef.current.getBoundingClientRect();
      setTargetRect({ x: rect.x + 16, y: rect.y + 16, width: rect.width - 32, height: rect.height - 32 });
      setPhase('initial');
    } else {
      setPhase('done');
    }
  }, [image, phase, focusOriginRect]);

  useLayoutEffect(() => {
    if (phase !== 'initial') return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('animating'));
    });
  }, [phase]);

  useEffect(() => {
    if (phase === 'animating') {
      const timer = setTimeout(() => setPhase('done'), 380);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Exit animation trigger
  useLayoutEffect(() => {
    if (phase !== 'exit-start') return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('exiting'));
    });
  }, [phase]);

  useEffect(() => {
    if (phase === 'exiting') {
      const timer = setTimeout(() => setSelectedImage(null), 350);
      return () => clearTimeout(timer);
    }
  }, [phase, setSelectedImage]);

  const handleClose = useCallback(() => {
    if (phase === 'done' && focusOriginRect) {
      setClosingFocus(true);
      setPhase('exit-start');
    } else {
      setSelectedImage(null);
    }
  }, [phase, focusOriginRect, setSelectedImage, setClosingFocus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  if (!image) return null;

  const src = `local-file://${image.original_path}`;

  const getImgStyle = (): React.CSSProperties => {
    if (phase === 'initial' && focusOriginRect) {
      return {
        position: 'fixed',
        left: focusOriginRect.x,
        top: focusOriginRect.y,
        width: focusOriginRect.width,
        height: focusOriginRect.height,
        borderRadius: '8px',
        objectFit: 'cover',
        zIndex: 70,
      };
    }
    if (phase === 'animating' && targetRect) {
      return {
        position: 'fixed',
        left: targetRect.x,
        top: targetRect.y,
        width: targetRect.width,
        height: targetRect.height,
        transition: 'all 350ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        borderRadius: '8px',
        objectFit: 'contain',
        zIndex: 70,
      };
    }
    if (phase === 'exit-start' && targetRect) {
      return {
        position: 'fixed',
        left: targetRect.x,
        top: targetRect.y,
        width: targetRect.width,
        height: targetRect.height,
        borderRadius: '8px',
        objectFit: 'contain',
        zIndex: 70,
      };
    }
    if (phase === 'exiting' && focusOriginRect) {
      return {
        position: 'fixed',
        left: focusOriginRect.x,
        top: focusOriginRect.y,
        width: focusOriginRect.width,
        height: focusOriginRect.height,
        transition: 'all 350ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        borderRadius: '8px',
        objectFit: 'cover',
        zIndex: 70,
      };
    }
    return {};
  };

  const isExiting = phase === 'exit-start' || phase === 'exiting';
  const showOverlay = phase === 'initial' || phase === 'animating' || isExiting;
  const showBg = !isExiting;

  return (
    <main className={`absolute inset-0 flex flex-col z-40 transition-opacity duration-200 ${isExiting ? 'opacity-0 pointer-events-none' : 'bg-gray-950'}`}>
      {showBg && (
        <header className={`h-12 shrink-0 flex items-center gap-3 px-4 border-b border-gray-800 transition-opacity duration-300 ${phase === 'done' || phase === 'animating' ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <span className="text-sm text-gray-300 truncate">{image.title || image.filename}</span>
        </header>
      )}
      <div ref={containerRef} className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {phase === 'done' && (
          <img
            src={src}
            alt={image.title || image.filename}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        )}
      </div>
      {showOverlay && (
        <img
          src={src}
          alt={image.title || image.filename}
          style={getImgStyle()}
        />
      )}
    </main>
  );
}
