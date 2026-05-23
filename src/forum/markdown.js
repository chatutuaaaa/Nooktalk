import DOMPurify from "dompurify";
import { marked } from "marked";
import hljs from "highlight.js";
import copyOneIcon from "../assets/copy-one.svg";

function normalizeMarkdownInput(input) {
  let normalized = String(input || "");
  if (!normalized.includes("\n") && normalized.includes("\\n")) {
    normalized = normalized.replace(/\\n/g, "\n");
  }
  if (/\\[`*_#[\]()>-]/.test(normalized)) {
    normalized = normalized.replace(/\\([`*_#[\]()>-])/g, "$1");
  }
  return normalized;
}

function buildPostMarkdownRenderer() {
  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (ch) => {
      if (ch === "&") return "&amp;";
      if (ch === "<") return "&lt;";
      if (ch === ">") return "&gt;";
      if (ch === '"') return "&quot;";
      return "&#39;";
    });
  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }) => {
    const language = String(lang || "").trim().toLowerCase();
    const languageLabel = language || "plain";
    const source = String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, "    ");
    const encodedSource = encodeURIComponent(source);
    const rows = source.split("\n");
    const lineHtml = rows
      .map((line, idx) => {
        const highlighted =
          language && hljs.getLanguage(language)
            ? hljs.highlight(line || " ", { language, ignoreIllegals: true }).value
            : escapeHtml(line || " ");
        return `<span class="md-code-line"><span class="md-code-line-no">${idx + 1}</span><span class="md-code-line-content">${highlighted}</span></span>`;
      })
      .join("");
    return `<div class="md-code-block"><div class="md-code-head"><span class="md-code-lang">${escapeHtml(languageLabel)}</span><button type="button" class="md-code-copy" data-code="${encodedSource}" aria-label="复制代码"><img src="${copyOneIcon}" alt="" /></button></div><pre><code class="hljs language-${escapeHtml(languageLabel)}">${lineHtml}</code></pre></div>`;
  };
  return renderer;
}

const postMarkdownRenderer = buildPostMarkdownRenderer();

export function renderMarkdown(mdText) {
  try {
    const normalized = normalizeMarkdownInput(mdText);
    const raw = marked.parse(normalized, { gfm: true, breaks: true, renderer: postMarkdownRenderer });
    return DOMPurify.sanitize(raw);
  } catch {
    return "";
  }
}

export function renderMarkdownSnippet(mdText, maxChars = 360) {
  const normalized = normalizeMarkdownInput(mdText).trim();
  if (!normalized.length) return "";
  let snippet = normalized;
  if (normalized.length > maxChars) {
    let cut = normalized.slice(0, maxChars);
    const lastNl = cut.lastIndexOf("\n");
    if (lastNl > maxChars * 0.45) cut = cut.slice(0, lastNl);
    snippet = `${cut.trimEnd()}…`;
  }
  try {
    const raw = marked.parse(snippet, { gfm: true, breaks: true, renderer: postMarkdownRenderer });
    return DOMPurify.sanitize(raw);
  } catch {
    return "";
  }
}

export async function handleMarkdownCodeCopyClick(e) {
  const copyBtn = e.target instanceof Element ? e.target.closest(".md-code-copy") : null;
  if (!copyBtn) return false;
  const encoded = copyBtn.getAttribute("data-code") || "";
  const content = decodeURIComponent(encoded);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
    } else {
      const ta = document.createElement("textarea");
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    copyBtn.dataset.copied = "1";
    window.setTimeout(() => {
      delete copyBtn.dataset.copied;
    }, 1200);
  } catch {
    // ignore
  }
  return true;
}
