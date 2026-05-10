import type { MouseEvent } from 'react';
import ReactMarkdown from 'react-markdown';

type MarkdownVariant = 'compact' | 'full';

// Muestra la descripcion en formato markdown
export function DescriptionMarkdownPreview({
  markdown,
  variant = 'compact',
  emptyLabel,
  linksStopPropagation = false,
}: {
  markdown: string;
  variant?: MarkdownVariant;
  emptyLabel?: string;
  linksStopPropagation?: boolean;
}) {
  const emptyText = emptyLabel ?? 'Sin contenido para previsualizar.';
  const isFullDetail = variant === 'full';

  // Si no hay texto evitamos render de markdown y mostramos mensaje simple
  if (!markdown.trim()) {
    let emptyClassName =
      'text-xs text-surface-500 dark:text-surface-400';
    if (isFullDetail) {
      emptyClassName = 'text-sm text-surface-500 dark:text-surface-400';
    }
    return (
      <p className={emptyClassName}>
        {emptyText}
      </p>
    );
  }

  let containerClassName =
    'markdown-preview max-h-64 overflow-y-auto rounded-md border border-surface-200 bg-surface-50/90 px-3 py-2 text-sm text-surface-800 dark:border-surface-700 dark:bg-surface-900/60 dark:text-surface-200';
  if (variant === 'full') {
    // Version completa para el panel de detalle con lectura mas comoda
    containerClassName =
      'markdown-preview w-full min-h-20 break-words rounded-md border border-surface-200 bg-surface-50 px-3 py-3 text-base leading-relaxed text-surface-900 shadow-sm dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100';
  }

  let onLinkClick: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  if (linksStopPropagation) {
    // En modo editable, el click del enlace no debe abrir la edicion por accidente
    onLinkClick = (event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation();
  }

  let markdownCodeClassName =
    'rounded bg-surface-200/90 px-1 py-0.5 font-mono text-xs dark:bg-surface-800';
  if (isFullDetail) {
    markdownCodeClassName =
      'rounded bg-surface-200/90 px-1 py-0.5 font-mono text-sm dark:bg-surface-800';
  }

  let markdownH2HeadingClass =
    'mb-2 text-sm font-bold text-surface-900 dark:text-surface-50';
  if (isFullDetail) {
    markdownH2HeadingClass =
      'mb-2 text-base font-bold text-surface-900 dark:text-surface-50';
  }

  let markdownH3HeadingClass =
    'mb-1 text-sm font-semibold text-surface-900 dark:text-surface-50';
  if (isFullDetail) {
    markdownH3HeadingClass =
      'mb-1 text-base font-semibold text-surface-900 dark:text-surface-50';
  }

  let markdownPreClassName =
    'my-2 overflow-x-auto rounded-md border border-surface-200 bg-surface-100 p-2 text-xs dark:border-surface-700 dark:bg-surface-950';
  if (isFullDetail) {
    markdownPreClassName =
      'my-2 overflow-x-auto rounded-md border border-surface-200 bg-surface-100 p-2 text-sm dark:border-surface-700 dark:bg-surface-950';
  }

  return (
    <div className={containerClassName}>
      {/* ReactMarkdown transforma el texto para mostrarlo en pantalla */}
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-surface-900 dark:text-surface-50">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-surface-700 dark:text-surface-300">{children}</em>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={onLinkClick}
              className="text-primary-600 underline underline-offset-2 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 list-inside list-disc space-y-1 pl-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-inside list-decimal space-y-1 pl-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ children }) => (
            <code className={markdownCodeClassName}>
              {children}
            </code>
          ),
          h1: ({ children }) => (
            <h3 className="mb-2 text-base font-bold text-surface-900 dark:text-surface-50">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className={markdownH2HeadingClass}>{children}</h3>
          ),
          h3: ({ children }) => (
            <h3 className={markdownH3HeadingClass}>{children}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-surface-400 pl-3 text-surface-700 italic dark:border-surface-500 dark:text-surface-300">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-3 border-surface-200 dark:border-surface-700" />
          ),
          pre: ({ children }) => (
            <pre className={markdownPreClassName}>
              {children}
            </pre>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
