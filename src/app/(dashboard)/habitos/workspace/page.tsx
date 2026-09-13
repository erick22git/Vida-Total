"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  GraduationCap,
  Kanban,
  NotebookPen,
  Plus,
  Sparkles,
  Trash2,
  Type,
  ListChecks,
  Heading,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { useHabitsStore } from "@/lib/store/habitsStore";
import { NotionBlockView } from "@/components/habitos/notion-block";
import { KanbanBoard } from "@/components/habitos/kanban-board";
import type { NotionBlockType } from "@/lib/types/habits";

type ViewMode = "documento" | "tablero";

const TEMPLATES: {
  id: string;
  label: string;
  icon: string;
  blocks: { type: NotionBlockType; content: string; items?: { text: string }[] }[];
}[] = [
  {
    id: "estudio",
    label: "Estudio",
    icon: "GraduationCap",
    blocks: [
      { type: "heading", content: "Plan de estudio" },
      { type: "text", content: "Tema: " },
      {
        type: "checklist",
        content: "",
        items: [{ text: "Leer material" }, { text: "Hacer resumen" }, { text: "Repasar" }],
      },
    ],
  },
  {
    id: "proyecto",
    label: "Proyecto",
    icon: "FileText",
    blocks: [
      { type: "heading", content: "Nuevo proyecto" },
      { type: "text", content: "Objetivo del proyecto..." },
      {
        type: "checklist",
        content: "",
        items: [{ text: "Definir alcance" }, { text: "Primer entregable" }],
      },
    ],
  },
  {
    id: "notas",
    label: "Notas libres",
    icon: "NotebookPen",
    blocks: [{ type: "text", content: "" }],
  },
];

const TEMPLATE_ICONS: Record<string, typeof GraduationCap> = {
  GraduationCap,
  FileText,
  NotebookPen,
};

export default function WorkspacePage() {
  const pages = useHabitsStore((s) => s.pages);
  const activePageId = useHabitsStore((s) => s.activePageId);
  const setActivePageId = useHabitsStore((s) => s.setActivePageId);
  const addPage = useHabitsStore((s) => s.addPage);
  const removePage = useHabitsStore((s) => s.removePage);
  const addBlock = useHabitsStore((s) => s.addBlock);

  const [viewMode, setViewMode] = useState<ViewMode>("documento");
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0] ?? null;

  function createFromTemplate(templateId: string) {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    addPage({
      title: customTitle.trim() || template.label,
      icon: template.icon,
      blocks: template.blocks.map((b) => ({
        id: Math.random().toString(36).slice(2),
        type: b.type,
        content: b.content,
        items: b.items?.map((i) => ({
          id: Math.random().toString(36).slice(2),
          text: i.text,
          done: false,
        })),
      })),
    });
    setCustomTitle("");
    setTemplateModalOpen(false);
  }

  function handleAddBlock(type: NotionBlockType) {
    if (!activePage) return;
    addBlock(activePage.id, {
      type,
      content: "",
      items: type === "checklist" ? [] : undefined,
    });
    setBlockPickerOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/habitos" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles size={20} style={{ color: "var(--habitos)" }} /> Workspace
        </h1>
      </header>

      <div className="flex items-center gap-2">
        {(["documento", "tablero"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className="rounded-full px-4 py-1.5 text-xs md:text-sm font-medium cursor-pointer border transition-colors capitalize"
            style={{
              color: viewMode === mode ? "white" : "rgba(255,255,255,0.55)",
              background: viewMode === mode ? "var(--habitos)" : "rgba(255,255,255,0.05)",
              borderColor: viewMode === mode ? "var(--habitos)" : "rgba(255,255,255,0.12)",
            }}
          >
            {mode === "documento" ? "Documento" : "Tablero"}
          </button>
        ))}
      </div>

      {viewMode === "tablero" ? (
        <KanbanBoard />
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible md:w-52 shrink-0">
            {pages.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePageId(p.id)}
                className="shrink-0 flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-sm text-left cursor-pointer transition-colors group"
                style={{
                  background: p.id === activePage?.id ? "var(--habitos)1F" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${p.id === activePage?.id ? "var(--habitos)55" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <span className="flex items-center gap-2 truncate">
                  <FileText size={14} className="text-white/50 shrink-0" />
                  <span className="truncate text-white/85">{p.title}</span>
                </span>
                {pages.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removePage(p.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 shrink-0"
                  >
                    <Trash2 size={12} />
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setTemplateModalOpen(true)}
              className="shrink-0 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-white/55 hover:text-white cursor-pointer border border-dashed border-white/15 hover:border-white/30 transition-colors"
            >
              <Plus size={14} /> Nueva página
            </button>
          </div>

          <GlassCard accentColor="var(--habitos)" className="flex-1 flex flex-col gap-3 min-h-[300px]">
            {activePage ? (
              <>
                <p className="text-lg md:text-xl font-semibold text-white px-2">{activePage.title}</p>
                <div className="flex flex-col gap-1">
                  {activePage.blocks.map((block) => (
                    <NotionBlockView key={block.id} pageId={activePage.id} block={block} />
                  ))}
                </div>
                <div className="relative px-2 pt-2">
                  <button
                    onClick={() => setBlockPickerOpen((v) => !v)}
                    className="flex items-center gap-2 text-sm text-white/40 hover:text-white cursor-pointer"
                  >
                    <Plus size={15} /> Agregar bloque
                  </button>
                  {blockPickerOpen && (
                    <div className="absolute left-2 top-9 z-10 flex flex-col gap-1 rounded-2xl glass-panel p-1.5 shadow-xl">
                      <button
                        onClick={() => handleAddBlock("text")}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/75 hover:bg-white/[0.08] cursor-pointer"
                      >
                        <Type size={14} /> Texto
                      </button>
                      <button
                        onClick={() => handleAddBlock("heading")}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/75 hover:bg-white/[0.08] cursor-pointer"
                      >
                        <Heading size={14} /> Encabezado
                      </button>
                      <button
                        onClick={() => handleAddBlock("checklist")}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/75 hover:bg-white/[0.08] cursor-pointer"
                      >
                        <ListChecks size={14} /> Checklist
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-white/40 text-center py-10">
                Crea tu primera página para empezar.
              </p>
            )}
          </GlassCard>
        </div>
      )}

      <button
        onClick={() => setTemplateModalOpen(true)}
        className="fixed bottom-24 md:bottom-8 right-6 flex items-center justify-center w-14 h-14 rounded-full cursor-pointer z-30"
        style={{ background: "var(--habitos)", boxShadow: "0 4px 24px var(--habitos)77" }}
      >
        {viewMode === "tablero" ? <Kanban size={22} className="text-white" /> : <Plus size={24} className="text-white" />}
      </button>

      <GlassModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Nueva página"
      >
        <div className="flex flex-col gap-4">
          <GlassInput
            placeholder="Título (opcional)"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            {TEMPLATES.map((t) => {
              const Icon = TEMPLATE_ICONS[t.icon] ?? FileText;
              return (
                <button
                  key={t.id}
                  onClick={() => createFromTemplate(t.id)}
                  className="flex items-center gap-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] glass-specular-ring px-4 py-3 text-left transition-colors cursor-pointer"
                >
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                    style={{ background: "var(--habitos)22" }}
                  >
                    <Icon size={16} style={{ color: "var(--habitos)" }} />
                  </div>
                  <span className="text-sm font-medium text-white">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
