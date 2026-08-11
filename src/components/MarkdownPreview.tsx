import React, { useMemo } from 'react';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false,
});

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/** Renders GFM markdown with raw HTML/CSS (notebook document preview). */
const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className }) => {
  const html = useMemo(() => {
    const parsed = marked.parse(content ?? '', { async: false });
    return typeof parsed === 'string' ? parsed : '';
  }, [content]);

  return (
    <article
      className={className ?? 'markdown-preview'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownPreview;
