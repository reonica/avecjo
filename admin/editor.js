/* HTML stays HTML: existing tables, links and French content do not round-trip through Markdown. */
(function () {
  const h = window.h;
  const clean = value => window.DOMPurify.sanitize(value || '', {FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'base', 'link', 'meta', 'form', 'input', 'button', 'textarea'], FORBID_ATTR: ['srcdoc']});
  const HtmlControl = window.createClass({
    componentDidMount: function () {
      const area = this.area;
      const original = this.props.value || '';
      area.value = clean(original);
      const editor = this.editor = window.Jodit.make(area, {
        height: 480,
        language: 'en',
        toolbarAdaptive: false,
        buttons: 'source,|,bold,italic,underline,|,ul,ol,|,paragraph,|,link,image,table,|,undo,redo,|,fullsize',
        buttonsMD: 'source,bold,italic,ul,ol,paragraph,link,image,table,undo,redo',
        showCharsCounter: false,
        showWordsCounter: true,
        spellcheck: true,
        askBeforePasteHTML: true,
        askBeforePasteFromWord: true,
        defaultActionOnPaste: 'insert_clear_html',
        cleanHTML: {removeTags: 'script,style,object,embed,svg,math,base,link,meta,form,input,button'},
        uploader: {insertImageAsBase64URI: false},
        filebrowser: {ajax: {url: ''}},
        disablePlugins: ['file', 'video'],
      });
      editor.value = clean(original);
      editor.editor.setAttribute('role', 'textbox');
      editor.editor.setAttribute('aria-label', 'Nội dung bài viết');
      editor.editor.setAttribute('aria-multiline', 'true');
      // Listen only after loading. Merely opening a legacy article never saves editor-normalized HTML.
      this.changeHandler = value => { if (value !== (this.props.value || '')) this.props.onChange(value); };
      editor.events.on('change', this.changeHandler);
    },
    componentDidUpdate: function (previous) {
      if (previous.value !== this.props.value && this.editor && this.editor.value !== clean(this.props.value)) this.editor.value = clean(this.props.value);
    },
    componentWillUnmount: function () {
      if (this.editor) { this.editor.events.off('change', this.changeHandler); this.editor.destruct(); }
    },
    render: function () {
      return h('div', {className: 'html-control'}, h('textarea', {id: this.props.forID, ref: element => { this.area = element; }, 'aria-label': 'Nội dung bài viết'}));
    },
  });
  const HtmlPreview = window.createClass({
    render: function () {
      // Render in a sandboxed iframe: article HTML cannot execute scripts or access CMS credentials.
      return h('iframe', {title: 'Xem trước nội dung', sandbox: '', style: {width: '100%', minHeight: '650px', border: 0}, srcDoc: '<!doctype html><html lang="fr"><head><meta charset="utf-8"><base href="' + location.origin + '/"><style>body{font:18px/1.8 Georgia,serif;color:#213b4c;padding:20px}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #ccd6dc;padding:8px}</style></head><body>' + (this.props.value || '') + '</body></html>'});
    },
  });
  window.CMS.registerWidget('avecjo-html', HtmlControl, HtmlPreview);
  const escape = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  window.CMS.registerPreviewTemplate('posts', window.createClass({
    render: function () {
      const get = name => this.props.entry.getIn(['data', name]) || '';
      const image = get('image');
      const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><base href="' + location.origin + '/"><style>body{margin:0;padding:28px;font:18px/1.8 Georgia,serif;color:#213b4c}h1{font-size:34px;line-height:1.2}h2,h3{line-height:1.35}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #ccd6dc;padding:8px}.byline{font:14px/1.5 system-ui;color:#58707c}a{color:#305977}</style></head><body><p class="byline">LE CARNET DE JO</p><h1>' + escape(get('title')) + '</h1><p class="byline">' + escape(get('date')) + '</p>' + (image ? '<img src="' + escape(image) + '" alt="' + escape(get('imageAlt')) + '">' : '') + '<article>' + get('html') + '</article></body></html>';
      return h('iframe', {title: 'Xem trước bài viết', sandbox: '', style: {width:'100%',minHeight:'900px',border:0}, srcDoc: html});
    },
  }));
})();
