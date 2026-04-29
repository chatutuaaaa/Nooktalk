/**
 * Toast UI Editor 自带 WYSIWYG 代码块 NodeView 将 stopEvent() 固定为 true，
 * 在 ProseMirror 中会阻断从 code 等元素冒泡的键盘/输入事件链路（eventBelongsToView 返回 false），
 * 部分环境下代码块内无法正常输入。此处复刻官方实现并把 stopEvent 改为 false。
 *
 * 结构与行为参考：node_modules/@toast-ui/editor 内置 CodeBlockView（及 nhn/tui.editor codeBlockView.ts）。
 */
import { TextSelection } from "prosemirror-state";

const WRAPPER_CLASS_NAME = "toastui-editor-ww-code-block";
const CODE_BLOCK_LANG_CLASS_NAME = "toastui-editor-ww-code-block-language";

/** 常用语言标识（hljs / markdown fenced code 常用名，小写） */
const COMMON_LANGUAGES = [
  "bash",
  "c",
  "csharp",
  "cpp",
  "css",
  "dockerfile",
  "go",
  "graphql",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "markdown",
  "php",
  "powershell",
  "python",
  "ruby",
  "rust",
  "scss",
  "shell",
  "sql",
  "swift",
  "text",
  "typescript",
  "xml",
  "yaml",
].sort();

function isFn(x) {
  return typeof x === "function";
}

function css(el, styles) {
  Object.keys(styles).forEach((k) => {
    el.style[k] = styles[k];
  });
}

function removeNode(node) {
  const p = node.parentNode;
  if (p) p.removeChild(node);
}

function setAttributes(attrs, el) {
  if (!attrs) return;
  Object.keys(attrs).forEach((key) => {
    const v = attrs[key];
    if (v !== null && v !== undefined && v !== "") {
      el.setAttribute(key, String(v));
    }
  });
}

/** 与官方 getCustomAttrs：无自定义属性时可空 */
function getCustomAttrs() {
  return {};
}

export function createWysiwygCodeBlockPlugin() {
  return () => ({
    wysiwygNodeViews: {
      codeBlock(node, view, getPos, eventEmitter) {
        return new WysiwygCodeBlockView(node, view, getPos, eventEmitter);
      },
    },
  });
}

class WysiwygCodeBlockView {
  constructor(node, view, getPos, eventEmitter) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.eventEmitter = eventEmitter;
    this.contentDOM = null;
    this.timer = null;
    /** @type {HTMLInputElement | null} */
    this.langSearchInput = null;
    /** @type {HTMLElement | null} */
    this.langPanel = null;
    /** @type {HTMLElement | null} */
    this.lineNoGutter = null;
    /** @type {(() => void) | null} */
    this.detachOutsideClose = null;

    this.handleMousedown = (ev) => {
      const target = ev.target;
      const style = getComputedStyle(target, ":after");
      if (style.backgroundImage !== "none" && isFn(this.getPos)) {
        ev.preventDefault();
        this.createLanguageEditor();
      }
    };

    this.onLangSearchKeydown = (ev) => {
      if (ev.key === "Enter" && this.langSearchInput) {
        ev.preventDefault();
        this.applyLanguageAndClose(this.langSearchInput.value);
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        this.dismissLanguageEditor();
      }
    };

    this.onLangSearchInput = () => this.renderLangListFiltered();

    this.handleCodeKeydown = (ev) => {
      if (ev.key === "Escape" || (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey))) {
        ev.preventDefault();
        ev.stopPropagation();
        this.exitCodeBlock();
      }
    };

    this.createElement();
    this.bindDOMEvent();
    this.bindEvent();
  }

  createElement() {
    const language = this.node.attrs.language;
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-language", language || "text");
    wrapper.className = WRAPPER_CLASS_NAME;
    const pre = this.createCodeBlockElement();
    const code = pre.querySelector("code");
    wrapper.appendChild(pre);
    this.dom = wrapper;
    this.contentDOM = code;
    this.renderLineNumbers();
  }

  createCodeBlockElement() {
    const pre = document.createElement("pre");
    pre.className = "forum-ww-code-pre";
    const gutter = document.createElement("span");
    gutter.className = "forum-ww-code-gutter";
    gutter.setAttribute("contenteditable", "false");
    gutter.setAttribute("aria-hidden", "true");
    const code = document.createElement("code");
    code.className = "forum-ww-code-content";
    const language = this.node.attrs.language;
    const attrs = getCustomAttrs(this.node.attrs);
    if (language) {
      code.setAttribute("data-language", language);
    }
    setAttributes(attrs, pre);
    this.lineNoGutter = gutter;
    pre.appendChild(gutter);
    pre.appendChild(code);
    return pre;
  }

  renderLineNumbers() {
    if (!this.lineNoGutter) return;
    const text = this.node?.textContent ?? "";
    const count = Math.max(1, text.split("\n").length);
    this.lineNoGutter.textContent = "";
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= count; i += 1) {
      const line = document.createElement("span");
      line.textContent = String(i);
      frag.appendChild(line);
    }
    this.lineNoGutter.appendChild(frag);
  }

  /** 打开下拉：顶部输入框筛选 / 手写语言名，下列表点选常用项 */
  createLanguageEditor() {
    if (this.langPanel || !isFn(this.getPos)) return;

    const rect = this.dom.getBoundingClientRect();
    const parent = this.view.dom.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === "static") {
      parent.style.position = "relative";
    }

    const panel = document.createElement("span");
    panel.className = `${CODE_BLOCK_LANG_CLASS_NAME} forum-code-lang-picker`;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "代码块语言");

    const search = document.createElement("input");
    search.type = "text";
    search.className = "forum-code-lang-search";
    search.setAttribute("autocomplete", "off");
    search.setAttribute("spellcheck", "false");
    search.placeholder = "筛选或输入语言标识";
    search.value = (this.node.attrs.language || "").trim();

    const list = document.createElement("ul");
    list.className = "forum-code-lang-list";

    panel.appendChild(search);
    panel.appendChild(list);

    parent.appendChild(panel);

    // 左上角与整块代码对齐：与顶栏伪元素展示语言名的位置重合（不再向下偏移一排）
    const availW = Math.max(200, parentRect.width - 8);
    const availH = Math.max(140, parentRect.height - 8);
    const panelW = Math.min(Math.max(220, 260), 320, availW);
    let left = rect.left - parentRect.left;
    if (left + panelW > availW) {
      left = Math.max(0, availW - panelW);
    }
    const top = Math.max(0, rect.top - parentRect.top);
    const maxTotalH = Math.max(140, Math.min(320, availH - top));
    css(panel, {
      position: "absolute",
      zIndex: "130",
      top: `${top}px`,
      left: `${left}px`,
      width: `${panelW}px`,
      maxHeight: `${maxTotalH}px`,
      boxSizing: "border-box",
    });

    this.langPanel = panel;
    this.langSearchInput = search;

    this.renderLangListFiltered();

    const onDocMouseDown = (e) => {
      if (!this.langPanel) return;
      if (this.langPanel.contains(e.target)) return;
      this.applyLanguageAndClose(this.langSearchInput?.value ?? "");
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    this.detachOutsideClose = () => document.removeEventListener("mousedown", onDocMouseDown, true);

    search.addEventListener("keydown", this.onLangSearchKeydown);
    search.addEventListener("input", this.onLangSearchInput);

    this.clearTimer();
    this.timer = setTimeout(() => {
      this.langSearchInput?.focus();
      this.langSearchInput?.select();
    });
  }

  renderLangListFiltered() {
    if (!this.langPanel || !this.langSearchInput) return;
    const raw = this.langSearchInput.value.trim().toLowerCase();
    const list = this.langPanel.querySelector(".forum-code-lang-list");
    if (!list) return;
    list.replaceChildren();
    const candidates = raw
      ? COMMON_LANGUAGES.filter((l) => l.includes(raw))
      : [...COMMON_LANGUAGES];
    candidates.slice(0, 120).forEach((lang) => {
      const li = document.createElement("li");
      li.textContent = lang;
      li.setAttribute("role", "option");
      li.tabIndex = -1;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.applyLanguageAndClose(lang);
      });
      list.appendChild(li);
    });
  }

  applyLanguageAndClose(value) {
    if (!this.langPanel || !isFn(this.getPos)) {
      return;
    }
    const trimmed = String(value ?? "").trim();
    const nextLang = trimmed.length ? trimmed.toLowerCase() : null;
    const pos = this.getPos();
    const current = this.view.state.doc.nodeAt(pos);
    this.removeLangPanel();
    if (!current) {
      return;
    }
    const tr = this.view.state.tr.setNodeMarkup(pos, null, {
      ...current.attrs,
      language: nextLang,
    });
    this.view.dispatch(tr);
  }

  dismissLanguageEditor() {
    this.removeLangPanel();
  }

  removeLangPanel() {
    this.clearTimer();
    if (typeof this.detachOutsideClose === "function") {
      try {
        this.detachOutsideClose();
      } catch {
        // noop
      }
      this.detachOutsideClose = null;
    }
    if (this.langSearchInput) {
      this.langSearchInput.removeEventListener("keydown", this.onLangSearchKeydown);
      this.langSearchInput.removeEventListener("input", this.onLangSearchInput);
    }
    if (this.langPanel?.parentNode) {
      removeNode(this.langPanel);
    }
    this.langPanel = null;
    this.langSearchInput = null;
  }

  bindDOMEvent() {
    if (this.dom) {
      this.dom.addEventListener("click", this.handleMousedown);
    }
    this.contentDOM?.addEventListener("keydown", this.handleCodeKeydown);
  }

  bindEvent() {
    this.eventEmitter.listen("scroll", () => {
      if (this.langPanel) {
        this.applyLanguageAndClose(this.langSearchInput?.value ?? "");
      }
    });
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  exitCodeBlock() {
    if (!isFn(this.getPos)) return;
    const pos = this.getPos();
    const { state } = this.view;
    const insertPos = pos + this.node.nodeSize;
    let tr = state.tr;
    const next = tr.doc.resolve(insertPos).nodeAfter;
    if (!next || next.type.name !== "paragraph") {
      const para = state.schema.nodes.paragraph?.create();
      if (!para) return;
      tr = tr.insert(insertPos, para);
    }
    const cursorPos = insertPos + 1;
    tr = tr.setSelection(TextSelection.create(tr.doc, cursorPos)).scrollIntoView();
    this.view.dispatch(tr);
    this.view.focus();
  }

  /** 必须为 false，否则会拦截 ProseMirror 在代码块内的按键/输入处理 */
  stopEvent() {
    return false;
  }

  update(node) {
    if (!node.sameMarkup(this.node)) {
      return false;
    }
    this.node = node;
    const lang = node.attrs.language;
    const labelRaw = lang && String(lang).trim() ? String(lang).trim().toLowerCase() : "text";
    if (this.dom && this.dom.getAttribute("data-language") !== labelRaw) {
      this.dom.setAttribute("data-language", labelRaw);
      const inner = labelRaw === "text" ? null : labelRaw;
      if (inner) {
        this.contentDOM?.setAttribute("data-language", inner);
      } else {
        this.contentDOM?.removeAttribute("data-language");
      }
    }
    this.renderLineNumbers();
    return true;
  }

  destroy() {
    this.dismissLanguageEditor();
    this.clearTimer();
    if (this.dom) {
      this.dom.removeEventListener("click", this.handleMousedown);
    }
    this.contentDOM?.removeEventListener("keydown", this.handleCodeKeydown);
  }
}
