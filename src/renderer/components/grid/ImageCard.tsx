import { useRef, useState, useEffect } from 'react';
import { FolderOpen, Tag, Trash2, Plus } from 'lucide-react';
import { useAppStore, type ImageRecord } from '../../stores/app-store';
import { api } from '../../lib/ipc';

interface Props {
  image: ImageRecord;
}

export function ImageCard({ image }: Props) {
  const { selectedImageId, setSelectedImage, setDraggingImage, folders, tags, trashImage, deleteImage, refreshAll, loadTags } = useAppStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedImageId === image.id;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [subMenu, setSubMenu] = useState<'tags' | 'folders' | null>(null);
  const [tagInput, setTagInput] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setSubMenu(null);
    setTagInput('');
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setSubMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  useEffect(() => {
    if (subMenu === 'tags' && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [subMenu]);

  const handleAddTag = async (tagName: string) => {
    const name = tagName.trim();
    if (!name) return;
    let tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      tag = await api.createTag(name);
    }
    await api.addTagToImage(image.id, tag!.id);
    loadTags();
    setContextMenu(null);
    setSubMenu(null);
  };

  const handleMoveToFolder = async (folderId: string) => {
    await api.updateImage(image.id, { folder_id: folderId });
    refreshAll();
    setContextMenu(null);
    setSubMenu(null);
  };


  return (
    <>
      <div
        ref={cardRef}
        data-image-id={image.id}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onContextMenu={handleContextMenu}
        className={`cursor-pointer rounded-lg overflow-hidden border-2 h-48
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

      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            onClick={() => setSubMenu(subMenu === 'tags' ? null : 'tags')}
          >
            <Tag size={12} />
            Add Tag
          </button>
          {subMenu === 'tags' && (
            <div className="px-2 py-1 border-t border-gray-700">
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTag(tagInput);
                  if (e.key === 'Escape') { setSubMenu(null); setTagInput(''); }
                }}
                placeholder="Tag name..."
                className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              {tagInput && (
                <div className="mt-1 max-h-24 overflow-y-auto">
                  {tags
                    .filter((t) => t.name.toLowerCase().includes(tagInput.toLowerCase()))
                    .slice(0, 6)
                    .map((t) => (
                      <button
                        key={t.id}
                        className="w-full px-2 py-1 text-xs text-left text-gray-300 hover:bg-gray-700 rounded"
                        onClick={() => handleAddTag(t.name)}
                      >
                        {t.name}
                      </button>
                    ))}
                </div>
              )}
              {tagInput && !tags.find((t) => t.name.toLowerCase() === tagInput.toLowerCase()) && (
                <button
                  className="w-full px-2 py-1 mt-1 text-xs text-left text-blue-400 hover:bg-gray-700 rounded flex items-center gap-1"
                  onClick={() => handleAddTag(tagInput)}
                >
                  <Plus size={10} /> Create "{tagInput}"
                </button>
              )}
            </div>
          )}

          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            onClick={() => setSubMenu(subMenu === 'folders' ? null : 'folders')}
          >
            <FolderOpen size={12} />
            Move to Folder
          </button>
          {subMenu === 'folders' && (
            <div className="px-2 py-1 border-t border-gray-700 max-h-32 overflow-y-auto">
              {folders.length === 0 ? (
                <p className="text-xs text-gray-500 px-2 py-1">No folders created</p>
              ) : (
                folders.map((folder) => (
                  <button
                    key={folder.id}
                    className={`w-full px-2 py-1 text-xs text-left rounded flex items-center gap-1.5 ${image.folder_id === folder.id ? 'text-blue-400 bg-blue-900/20' : 'text-gray-300 hover:bg-gray-700'}`}
                    onClick={() => handleMoveToFolder(folder.id)}
                  >
                    <FolderOpen size={10} className="text-yellow-500" />
                    {folder.name}
                  </button>
                ))
              )}
            </div>
          )}

          <div className="border-t border-gray-700 mt-1 pt-1">
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700 transition-colors"
              onClick={() => {
                setContextMenu(null);
                setSubMenu(null);
                if (image.is_trashed) {
                  deleteImage(image.id);
                } else {
                  trashImage(image.id);
                }
              }}
            >
              <Trash2 size={12} />
              {image.is_trashed ? 'Delete permanently' : 'Move to Trash'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
