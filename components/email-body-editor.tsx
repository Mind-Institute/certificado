"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Pilcrow,
  Braces,
} from "lucide-react";
import clsx from "clsx";

interface VariableOption {
  key: string;
  label: string;
}

interface EmailBodyEditorProps {
  value: string;
  onChange: (html: string) => void;
  relevantVariables: VariableOption[];
  placeholder?: string;
}

/**
 * Detect if a string looks like HTML (contains at least one tag) vs. legacy
 * plain-text-with-**bold** markdown-ish input.
 */
function looksLikeHtml(input: string): boolean {
  return /<\w+[\s>]/.test(input);
}

/**
 * One-time conversion of legacy plain text bodies to HTML so that the TipTap
 * editor receives a clean HTML string on first load. Paragraphs separated by
 * blank lines become <p>...</p>. Inline `**bold**` becomes <strong>bold</strong>.
 * Single newlines inside a paragraph become <br/>.
 */
function legacyToHtml(input: string): string {
  if (!input) return "";
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const paragraphs = input
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => {
      const parts = p.split(/(\*\*[^*]+\*\*)/g);
      const inner = parts
        .map((part) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
          }
          return escapeHtml(part).replace(/\n/g, "<br/>");
        })
        .join("");
      return `<p>${inner}</p>`;
    })
    .join("");
}

/**
 * Normalize `value` to HTML for TipTap. If it already looks like HTML, return
 * as-is. Otherwise treat it as legacy markdown-ish text.
 */
function toEditorHtml(value: string): string {
  if (!value) return "";
  if (looksLikeHtml(value)) return value;
  return legacyToHtml(value);
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={clsx(
        "inline-flex items-center justify-center w-7 h-7 rounded text-xs border border-transparent hover:bg-gray-100",
        active && "bg-gray-200",
      )}
    >
      {children}
    </button>
  );
}

function VariableMenu({
  variables,
  onInsert,
}: {
  variables: VariableOption[];
  onInsert: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.("[data-variable-menu-root]")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" data-variable-menu-root>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Inserir variável"
        className={clsx(
          "inline-flex items-center gap-1 px-2 h-7 rounded text-xs border border-gray-200 bg-white hover:bg-gray-50",
          open && "bg-gray-100",
        )}
      >
        <Braces size={12} />
        Variável
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 flex flex-col gap-1 min-w-[240px]">
          {variables.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => {
                onInsert(v.key);
                setOpen(false);
              }}
              className="text-left text-xs font-mono px-2 py-1 rounded hover:bg-brand-green-mind/10"
            >
              {`{{${v.key}}}`}
              <span className="ml-2 font-sans text-gray-500">{v.label}</span>
            </button>
          ))}
          {variables.length === 0 && (
            <p className="text-xs text-gray-500 px-2 py-1">
              Nenhuma variável disponível
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Toolbar({
  editor,
  variables,
}: {
  editor: Editor;
  variables: VariableOption[];
}) {
  const insertLink = useCallback(() => {
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("URL:", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  const insertVariable = useCallback(
    (key: string) => {
      editor.chain().focus().insertContent(`{{${key}}}`).run();
    },
    [editor],
  );

  return (
    <div className="flex flex-wrap items-center gap-1 border border-gray-200 border-b-0 rounded-t-md bg-gray-50 px-2 py-1.5">
      <ToolbarButton
        title="Negrito"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Itálico"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={14} />
      </ToolbarButton>
      <span className="w-px h-5 bg-gray-200 mx-0.5" aria-hidden="true" />
      <ToolbarButton
        title="Parágrafo"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Lista com marcadores"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Link"
        active={editor.isActive("link")}
        onClick={insertLink}
      >
        <Link2 size={14} />
      </ToolbarButton>
      <span className="w-px h-5 bg-gray-200 mx-0.5" aria-hidden="true" />
      <VariableMenu variables={variables} onInsert={insertVariable} />
    </div>
  );
}

export function EmailBodyEditor({
  value,
  onChange,
  relevantVariables,
  placeholder,
}: EmailBodyEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // StarterKit ships with bold, italic, bullet/ordered list, paragraph,
        // headings, hr, blockquote, code, code block, etc. We keep defaults.
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-brand-black underline",
          rel: "noopener noreferrer nofollow",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Escreva aqui...",
      }),
    ],
    content: toEditorHtml(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "mind-email-prose focus:outline-none min-h-[260px] px-4 py-3 text-sm leading-relaxed",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Keep the editor content in sync if `value` is updated externally (e.g.,
  // when the parent form switches between templates). We only call setContent
  // when the incoming HTML differs from the editor's current HTML to avoid
  // resetting the cursor mid-typing.
  useEffect(() => {
    if (!editor) return;
    const normalized = toEditorHtml(value);
    const current = editor.getHTML();
    // TipTap returns "<p></p>" for empty docs; normalize for comparison.
    const emptyForms = new Set(["", "<p></p>"]);
    const a = emptyForms.has(normalized) ? "" : normalized;
    const b = emptyForms.has(current) ? "" : current;
    if (a !== b) {
      editor.commands.setContent(normalized, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="border border-gray-200 rounded-md bg-white min-h-[320px]" />
    );
  }

  return (
    <div className="email-body-editor">
      <Toolbar editor={editor} variables={relevantVariables} />
      <div className="border border-gray-200 rounded-b-md bg-white focus-within:border-brand-green-mind focus-within:ring-2 focus-within:ring-brand-green-mind/30">
        <EditorContent editor={editor} />
      </div>
      <style jsx global>{`
        .mind-email-prose p {
          margin: 0 0 12px 0;
          line-height: 1.6;
        }
        .mind-email-prose p:last-child {
          margin-bottom: 0;
        }
        .mind-email-prose strong {
          font-weight: 700;
          color: #111;
        }
        .mind-email-prose em {
          font-style: italic;
        }
        .mind-email-prose a {
          color: #0a66c2;
          text-decoration: underline;
        }
        .mind-email-prose ul,
        .mind-email-prose ol {
          padding-left: 1.25rem;
          margin: 0 0 12px 0;
        }
        .mind-email-prose ul {
          list-style: disc;
        }
        .mind-email-prose ol {
          list-style: decimal;
        }
        .mind-email-prose li {
          margin: 2px 0;
          line-height: 1.6;
        }
        .mind-email-prose h1,
        .mind-email-prose h2,
        .mind-email-prose h3 {
          font-weight: 600;
          margin: 16px 0 8px 0;
          line-height: 1.3;
        }
        .mind-email-prose h1 {
          font-size: 1.5rem;
        }
        .mind-email-prose h2 {
          font-size: 1.25rem;
        }
        .mind-email-prose h3 {
          font-size: 1.125rem;
        }
        .mind-email-prose blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 12px;
          color: #4b5563;
          margin: 0 0 12px 0;
        }
        .mind-email-prose hr {
          border: 0;
          border-top: 1px solid #e5e7eb;
          margin: 16px 0;
        }
        .mind-email-prose code {
          background: #f3f4f6;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 0.85em;
        }
        /* Placeholder rendering for TipTap */
        .mind-email-prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}

export { looksLikeHtml };
