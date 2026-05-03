import { useRef } from 'react';
import { useAppStore, type ImageRecord } from '../../stores/app-store';

interface Props {
  image: ImageRecord;
}

export function ImageCard({ image }: Props) {
  const { selectedImageId, setSelectedImage, setDraggingImage } = useAppStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedImageId === image.id;

  const imageSrc = image.thumbnail_path
    ? `local-file://${image.thumbnail_path}`
    : `local-file://${image.original_path}`;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-muse-image', image.id);
    e.dataTransfer.effectAllowed = 'all';
    setDraggingImage(image.id);
  };

  const handleDragEnd = () => {
    setTimeout(() => setDraggingImage(null), 0);
  };

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all h-48
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-transparent hover:border-gray-700'}`}
      onClick={() => {
        const rect = cardRef.current?.getBoundingClientRect();
        setSelectedImage(image.id, rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null);
      }}
    >
      <img
        src={imageSrc}
        alt={image.title || image.filename}
        className="h-full w-auto block bg-gray-800 pointer-events-none"
        loading="lazy"
      />
    </div>
  );
}
