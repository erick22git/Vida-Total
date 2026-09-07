"use client";

import { useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useHabitsStore } from "@/lib/store/habitsStore";
import type { NotionBlock } from "@/lib/types/habits";

function AutoTextarea({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      rows={1}
      className={
        className ??
        "w-full bg-transparent outline-none resize-none text-sm text-white/85 placeholder:text-white/30"
      }
    />
  );
}

export function NotionBlockView({ pageId, block }: { pageId: string; block: NotionBlock }) {
  const updateBlock = useHabitsStore((s) => s.updateBlock);
  const removeBlock = useHabitsStore((s) => s.removeBlock);
  const [newItem, setNewItem] = useState("");

  function addChecklistItem() {
    if (!newItem.trim()) return;
    const items = block.items ?? [];
    updateBlock(pageId, block.id, {
      items: [...items, { id: Math.random().toString(36).slice(2), text: newItem.trim(), done: false }],
    });
    setNewItem("");
  }

  return (
    <div className="group relative flex items-start gap-2 rounded-2xl px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
      <div className="flex-1 min-w-0">
        {block.type === "heading" && (
          <AutoTextarea
            value={block.content}
            placeholder="Encabezado"
            onChange={(v) => updateBlock(pageId, block.id, { content: v })}
            className="w-full bg-transparent outline-none resize-none text-lg md:text-xl font-semibold text-white placeholder:text-white/30"
          />
        )}

        {block.type === "text" && (
          <AutoTextarea
            value={block.content}
            placeholder="Escribe algo..."
            onChange={(v) => updateBlock(pageId, block.id, { content: v })}
          />
        )}

        {block.type === "checklist" && (
          <div className="flex flex-col gap-1.5">
            {(block.items ?? []).map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateBlock(pageId, block.id, {
                      items: (block.items ?? []).map((i) =>
                        i.id === item.id ? { ...i, done: !i.done } : i,
                      ),
                    })
                  }
                  className="flex items-center justify-center rounded-md border shrink-0 cursor-pointer"
                  style={{
                    borderColor: item.done ? "var(--habitos)" : "rgba(255,255,255,0.3)",
                    background: item.done ? "var(--habitos)" : "transparent",
                    width: 18,
                    height: 18,
                  }}
                >
                  {item.done && <Check size={11} className="text-white" />}
                </button>
                <span
                  className={`text-sm ${item.done ? "line-through text-white/35" : "text-white/80"}`}
                >
                  {item.text}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
                placeholder="Agregar item..."
                className="flex-1 bg-transparent outline-none text-sm text-white/70 placeholder:text-white/25"
              />
              <button onClick={addChecklistItem} className="text-white/30 hover:text-white cursor-pointer">
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        onClick={() => removeBlock(pageId, block.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/25 hover:text-red-400 shrink-0 cursor-pointer mt-1"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
