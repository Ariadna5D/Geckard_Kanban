import type { MouseEvent } from 'react';
import ReactMarkdown from 'react-markdown';

type MarkdownVariant = 'compact' | 'full';

/**
 * Render de descripción en Markdown (react-markdown, sin HTML crudo arbitrario).
 */
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
  if (!markdown.trim()) {
    return (
      <p className="text-xs text-surface-500 dark:text-surface-400">
        {emptyLabel ?? 'Sin contenido para previsualizar.'}
      </p>
    );
  }

  const shellClass =
    variant === 'full'
      ? 'markdown-preview w-full min-h-[5rem] break-words rounded-md border border-surface-200 bg-surface-50 px-3 py-3 text-sm leading-relaxed text-surface-900 shadow-sm dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100'
      : 'markdown-preview max-h-64 overflow-y-auto rounded-md border border-surface-200 bg-surface-50/90 px-3 py-2 text-sm text-surface-800 dark:border-surface-700 dark:bg-surface-900/60 dark:text-surface-200';

  const onLinkClick = linksStopPropagation
    ? (e: MouseEvent<HTMLAnchorElement>) => e.stopPropagation()
    : undefined;

  return (
    <div className={shellClass}>
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
            <code className="rounded bg-surface-200/90 px-1 py-0.5 font-mono text-[0.85em] dark:bg-surface-800">
              {children}
            </code>
          ),
          h1: ({ children }) => (
            <h3 className="mb-2 text-base font-bold text-surface-900 dark:text-surface-50">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-2 text-sm font-bold text-surface-900 dark:text-surface-50">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 text-sm font-semibold text-surface-900 dark:text-surface-50">
              {children}
            </h3>
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
            <pre className="my-2 overflow-x-auto rounded-md border border-surface-200 bg-surface-100 p-2 text-xs dark:border-surface-700 dark:bg-surface-950">
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
