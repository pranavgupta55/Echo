// src/components/PlaylistFormModal.jsx
import { useEffect, useRef, useState } from 'react';

export default function PlaylistFormModal({ open, onClose, onSubmit, defaultName = '', title = 'New Playlist' }) {
  const [name, setName] = useState(defaultName);
  const dialogRef = useRef(null);

  useEffect(() => {
    setName(defaultName || '');
  }, [defaultName]);

  useEffect(() => {
    if (!dialogRef.current) return;
    if (open) dialogRef.current.showModal();
    else dialogRef.current.close();
  }, [open]);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black/60 p-0 rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl w-[90vw] max-w-md"
      onClose={onClose}
    >
      <form onSubmit={submit} className="p-6 space-y-4 text-sm text-white">
        <div className="text-lg font-semibold">{title}</div>
        <input
          autoFocus
          className="w-full px-4 py-3 rounded-xl bg-white/10 ring-1 ring-white/10 outline-none placeholder:text-gray-400"
          placeholder="Playlist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10">Cancel</button>
          <button className="px-4 py-2 rounded-xl bg-white text-black shadow-lg">Save</button>
        </div>
      </form>
    </dialog>
  );
}
