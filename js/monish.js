/*!
 * monish.js — Hexo 主题 monish 前端脚本
 * 纯 vanilla JS，无第三方依赖。接口约定见 DESIGN-CONTRACT.md §7。
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'monish-theme';
  var MODES = ['auto', 'light', 'dark'];
  var root = document.documentElement;
  var body = document.body;
  /**
   * 功能开关与 i18n 文案由 layout.ejs 写在 <html> 上（见设计契约 §3.1 / §3.13），
   * 这里必须读 root；读 body 会导致复制按钮 / 灯箱 / 搜索整条链路失效。
   */
  var config = {
    search: root.dataset.search === 'true',
    lightbox: root.dataset.lightbox === 'true',
    copyCode: root.dataset.copyCode === 'true',
    animation: root.dataset.animation !== 'false'
  };
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var animationOn = config.animation && !reduceMotion;

  // -------------------------------------------------------------------------
  // 工具
  // -------------------------------------------------------------------------
  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function on(target, type, handler, options) {
    if (target) target.addEventListener(type, handler, options);
  }

  /**
   * 读 `<html>` 上的 data-* 属性（layout.ejs 把 i18n 文案与功能开关写在这里）。
   * 同时兼容 kebab-case 与 camelCase 调用：stat('label-copy') 与
   * stat('labelCopy') 都能命中 data-label-copy。
   */
  function stat(key, fallback) {
    var base = String(key).replace(/^data-/, '');
    var candidates = ['data-' + base, 'data-' + base.replace(/([A-Z])/g, '-$1').toLowerCase()];
    for (var i = 0; i < candidates.length; i++) {
      var value = root.getAttribute(candidates[i]);
      if (value !== null) return value;
    }
    return fallback;
  }

  function toast(message) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      el.classList.remove('is-visible');
      toast._timer = setTimeout(function () { el.hidden = true; }, 260);
    }, 1800);
  }

  // -------------------------------------------------------------------------
  // 主题模式：auto / light / dark
  // -------------------------------------------------------------------------
  var THEME_ICON = {
    auto: 'fa-adjust',
    light: 'fa-sun-o',
    dark: 'fa-moon-o'
  };

  var theme = {
    /**
     * 当前模式：localStorage 优先；没有存储值时回退到 head.ejs 写下的
     * `data-theme-mode`（即主题配置 appearance.default_mode），而不是硬编码 auto。
     */
    get: function () {
      try {
        var saved = window.localStorage.getItem(STORAGE_KEY);
        if (MODES.indexOf(saved) >= 0) return saved;
      } catch (error) { /* 隐私模式忽略 */ }
      var configured = root.getAttribute('data-theme-mode');
      return MODES.indexOf(configured) >= 0 ? configured : 'auto';
    },

    resolve: function (mode) {
      if (mode === 'light' || mode === 'dark') return mode;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },

    apply: function () {
      var mode = theme.get();
      var resolved = theme.resolve(mode);
      root.setAttribute('data-theme-mode', mode);
      root.setAttribute('data-theme', resolved);
      root.style.colorScheme = resolved;

      var toggle = $('#theme-toggle');
      if (toggle) {
        toggle.setAttribute('data-mode', mode);
        var icon = $('.theme-toggle-icon', toggle);
        if (icon) icon.className = 'fa theme-toggle-icon ' + (THEME_ICON[mode] || THEME_ICON.auto);
        var label = $('.theme-toggle-label', toggle);
        if (label) {
          label.textContent = label.getAttribute('data-label-' + mode) || label.textContent;
        }
        toggle.setAttribute('title', label ? label.textContent : mode);
      }
      return resolved;
    },

    set: function (mode, options) {
      if (MODES.indexOf(mode) < 0) mode = 'auto';
      try {
        window.localStorage.setItem(STORAGE_KEY, mode);
      } catch (error) { /* 忽略写入失败 */ }
      var opts = options || {};
      if (opts.transition) theme.flashTransition();
      return theme.apply();
    },

    toggle: function () {
      var next = MODES[(MODES.indexOf(theme.get()) + 1) % MODES.length];
      return theme.set(next, { transition: true });
    },

    flashTransition: function () {
      root.classList.add('theme-transition');
      clearTimeout(theme._timer);
      theme._timer = setTimeout(function () {
        root.classList.remove('theme-transition');
      }, 360);
    }
  };

  function initTheme() {
    theme.apply();

    var toggle = $('#theme-toggle');
    on(toggle, 'click', function () {
      theme.toggle();
    });

    // 系统主题变化时，仅在 auto 模式下跟随
    if (window.matchMedia) {
      var media = window.matchMedia('(prefers-color-scheme: dark)');
      var handler = function () {
        if (theme.get() === 'auto') theme.apply();
      };
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', handler);
      } else if (typeof media.addListener === 'function') {
        media.addListener(handler);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 首屏入场
  // -------------------------------------------------------------------------
  function initHero() {
    var hero = $('#hero');
    if (!hero) return;
    // hero-ready 已在脚本加载时同步加上（见文件末尾），这里只接管交互。

    var scrollLink = $('#hero-scroll');
    on(scrollLink, 'click', function (event) {
      var target = $('#latest-posts');
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: animationOn ? 'smooth' : 'auto', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', '#latest-posts');
    });

    // 滚动到首屏之外后，顶栏切换为实底
    var header = $('#site-header');
    if (!header) return;
    var heroHeight = hero.offsetHeight || window.innerHeight;
    var update = function () {
      var scrolled = window.scrollY > Math.max(24, heroHeight - 96);
      header.classList.toggle('is-scrolled', scrolled);
    };
    update();
    on(window, 'scroll', update, { passive: true });
    on(window, 'resize', function () {
      heroHeight = hero.offsetHeight || window.innerHeight;
      update();
    });
  }

  // -------------------------------------------------------------------------
  // 顶栏滚动状态 / 进度条 / 返回顶部
  // -------------------------------------------------------------------------
  function initScrollEffects() {
    var header = $('#site-header');
    var progress = $('#progress-bar');
    var backToTop = $('#back-to-top');
    var ticking = false;

    function frame() {
      ticking = false;
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var height = document.documentElement.scrollHeight - window.innerHeight;

      if (header) {
        // 首页首屏：未滚动时顶栏覆盖在 hero 上（is-overlay），滚过之后摘掉并转为实底
        var isOverlayHeader = header.dataset.homeFirst === 'true';
        var scrolled = scrollTop > 24;
        header.classList.toggle('is-scrolled', scrolled);
        if (isOverlayHeader) header.classList.toggle('is-overlay', !scrolled);
      }

      if (progress) {
        var ratio = height > 0 ? Math.min(1, Math.max(0, scrollTop / height)) : 0;
        progress.style.setProperty('--progress', (ratio * 100).toFixed(2) + '%');
        progress.classList.toggle('is-hidden', ratio <= 0.001);
      }

      if (backToTop) {
        backToTop.classList.toggle('is-hidden', scrollTop < 320);
      }
    }

    function request() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(frame);
    }

    on(window, 'scroll', request, { passive: true });
    on(window, 'resize', request);
    on(backToTop, 'click', function () {
      window.scrollTo({ top: 0, behavior: animationOn ? 'smooth' : 'auto' });
    });
    frame();
  }

  // -------------------------------------------------------------------------
  // 移动端导航抽屉
  // -------------------------------------------------------------------------
  function initNavDrawer() {
    var toggle = $('#nav-toggle');
    var drawer = $('#nav-drawer');
    var backdrop = $('#nav-backdrop');
    if (!toggle || !drawer) return;

    var closeTimer = null;
    var isOpen = false;

    /**
     * 抽屉用 `hidden` 保证无障碍（display:none），但 display 变化无法过渡，
     * 所以打开时先撤 hidden、下一帧再加 .is-open；关闭时先摘 .is-open、
     * 等过渡跑完再挂 hidden。与灯箱同一套做法。
     */
    function setOpen(open) {
      if (open === isOpen) return;
      isOpen = open;
      clearTimeout(closeTimer);

      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.classList.toggle('no-scroll', open);
      var icon = $('.fa', toggle);
      if (icon) icon.className = 'fa ' + (open ? 'fa-times' : 'fa-bars');

      if (open) {
        drawer.hidden = false;
        if (backdrop) backdrop.hidden = false;
        var first = $('.drawer-link', drawer);
        requestAnimationFrame(function () {
          drawer.classList.add('is-open');
          if (backdrop) backdrop.classList.add('is-open');
          // 必须在 .is-open 生效之后再聚焦：此前是 visibility:hidden，聚焦会静默失败。
          // preventScroll 保证聚焦不带动页面滚动，所以 reduced-motion 下也照常聚焦。
          if (first) first.focus({ preventScroll: true });
        });
      } else {
        drawer.classList.remove('is-open');
        if (backdrop) backdrop.classList.remove('is-open');
        closeTimer = setTimeout(function () {
          drawer.hidden = true;
          if (backdrop) backdrop.hidden = true;
        }, animationOn ? 320 : 0);
      }
    }

    on(toggle, 'click', function () {
      setOpen(!isOpen);
    });
    on(backdrop, 'click', function () { setOpen(false); });
    $$('.drawer-link', drawer).forEach(function (link) {
      on(link, 'click', function () { setOpen(false); });
    });
    on(window, 'resize', function () {
      if (window.innerWidth > 768 && isOpen) setOpen(false);
    });
    on(document, 'keydown', function (event) {
      if (event.key === 'Escape' && isOpen) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // -------------------------------------------------------------------------
  // 滚动入场动画
  // -------------------------------------------------------------------------
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;

    if (!animationOn || !('IntersectionObserver' in window)) {
      items.forEach(function (item) { item.classList.add('is-revealed'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    items.forEach(function (item, index) {
      item.style.setProperty('--reveal-delay', Math.min(index % 6, 5) * 60 + 'ms');
      observer.observe(item);
    });
  }

  // -------------------------------------------------------------------------
  // 目录：折叠 + 滚动高亮
  // -------------------------------------------------------------------------
  function initToc() {
    var toc = $('#post-toc');
    if (!toc) return;

    var toggle = $('#post-toc-toggle');
    var nav = $('#post-toc-nav');
    on(toggle, 'click', function () {
      var collapsed = toc.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      if (nav) nav.hidden = collapsed;
    });

    var links = $$('.post-toc-nav a', toc);
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var headings = [];
    links.forEach(function (link) {
      var id = decodeURIComponent((link.getAttribute('href') || '').replace(/^#/, ''));
      var heading = id ? document.getElementById(id) : null;
      if (!heading) return;
      map[heading.id] = link;
      headings.push(heading);
    });
    if (!headings.length) return;

    var activeLink = null;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var link = map[entry.target.id];
        if (!link || link === activeLink) return;
        if (activeLink) activeLink.classList.remove('is-active');
        link.classList.add('is-active');
        activeLink = link;
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    headings.forEach(function (heading) { observer.observe(heading); });
  }

  // -------------------------------------------------------------------------
  // 代码复制
  // -------------------------------------------------------------------------
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        document.body.appendChild(area);
        area.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(area);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (error) {
        reject(error);
      }
    });
  }

  function initCopyCode() {
    if (!config.copyCode) return;
    var label = stat('label-copy') || 'Copy';
    var doneLabel = stat('label-copied') || 'Copied';

    $$('.monish-prose pre').filter(function (pre) {
      // 高亮代码块里 <pre> 出现两次：行号 gutter 与代码本体，只为代码本体加按钮
      return !pre.closest('.gutter') && !pre.closest('.line-number');
    }).forEach(function (pre) {
      // 挂到 figure.highlight 上，避免自己成为 <pre> 的最后一个子元素
      // （那会把 CSS 里 :last-child 系列选择器顶掉）
      // 优先挂进代码块工具条（与语言标签同排，互不遮挡）；
      // 否则退回 figure.highlight，最后才挂到 <pre>
      var figure = pre.closest('figure.highlight');
      var host = (figure && figure.querySelector('.code-toolbar')) || figure || pre;
      if ($('.code-copy', host)) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.setAttribute('aria-label', label);
      button.textContent = label;
      on(button, 'click', function () {
        var code = $('code', pre);
        var text = code ? code.innerText : pre.innerText;
        copyText(text).then(function () {
          button.textContent = doneLabel;
          button.classList.add('is-copied');
          setTimeout(function () {
            button.textContent = label;
            button.classList.remove('is-copied');
          }, 1600);
        }).catch(function () {
          toast(doneLabel);
        });
      });
      host.appendChild(button);
    });
  }

  // -------------------------------------------------------------------------
  // 图片灯箱
  // -------------------------------------------------------------------------
  function initLightbox() {
    if (!config.lightbox) return;
    var box = $('#lightbox');
    if (!box) return;

    var image = $('#lightbox-image');
    var caption = $('#lightbox-caption');
    var images = $$('.monish-prose img').filter(function (img) {
      return !img.closest('a');
    });
    if (!images.length) return;

    var index = 0;

    function show(nextIndex) {
      if (!images.length) return;
      index = (nextIndex + images.length) % images.length;
      var source = images[index];
      image.setAttribute('src', source.currentSrc || source.src);
      image.setAttribute('alt', source.alt || '');
      if (caption) caption.textContent = source.alt || source.title || '';
    }

    function open(nextIndex) {
      show(nextIndex);
      box.hidden = false;
      requestAnimationFrame(function () { box.classList.add('is-open'); });
      body.classList.add('is-lightbox-open');
      body.classList.add('no-scroll');
    }

    function close() {
      box.classList.remove('is-open');
      body.classList.remove('is-lightbox-open');
      body.classList.remove('no-scroll');
      setTimeout(function () { box.hidden = true; }, 220);
    }

    images.forEach(function (img, i) {
      img.classList.add('is-zoomable');
      on(img, 'click', function () { open(i); });
    });

    on($('#lightbox-close'), 'click', close);
    on($('#lightbox-prev'), 'click', function (event) { event.stopPropagation(); show(index - 1); });
    on($('#lightbox-next'), 'click', function (event) { event.stopPropagation(); show(index + 1); });
    on(box, 'click', function (event) {
      if (event.target === box || event.target === image) close();
    });
    on(document, 'keydown', function (event) {
      if (box.hidden) return;
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowLeft') show(index - 1);
      else if (event.key === 'ArrowRight') show(index + 1);
    });
  }

  // -------------------------------------------------------------------------
  // 本地搜索
  // -------------------------------------------------------------------------
  function initSearch() {
    if (!config.search) return;
    var box = $('#search-box');
    var mask = $('#search-mask');
    var input = $('#search-input');
    var results = $('#search-results');
    var openBtn = $('#search-toggle');
    var closeBtn = $('#search-close');
    if (!box || !input || !results) return;

    var index = null;
    var loading = null;
    var cursor = -1;
    var base = root.getAttribute('data-root') || '/';

    function label(key, fallback) {
      return stat(key) || fallback;
    }

    function open() {
      if (mask) mask.hidden = false;
      box.hidden = false;
      requestAnimationFrame(function () { box.classList.add('is-open'); });
      body.classList.add('no-scroll');
      input.focus();
      ensureIndex();
    }

    function close() {
      box.classList.remove('is-open');
      if (mask) mask.hidden = true;
      setTimeout(function () { box.hidden = true; }, 180);
      body.classList.remove('no-scroll');
      if (openBtn) openBtn.focus();
    }

    function ensureIndex() {
      if (index || loading) return loading;
      loading = fetch(base.replace(/\/$/, '') + '/search.json')
        .then(function (res) {
          if (!res.ok) throw new Error('search index ' + res.status);
          return res.json();
        })
        .then(function (data) {
          index = data || [];
          return index;
        })
        .catch(function () {
          index = [];
          if (results) {
            results.innerHTML = '<p class="search-empty">' +
              escapeHtml(label('label-search-empty', 'No results')) + '</p>';
          }
          return index;
        });
      return loading;
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }

    function render(list, keyword) {
      if (!list.length) {
        results.innerHTML = '<p class="search-empty">' + escapeHtml(label('label-search-empty', 'No results')) +
          (keyword ? ' ( ' + escapeHtml(keyword) + ' )' : '') + '</p>';
        cursor = -1;
        return;
      }
      results.innerHTML = list.map(function (item, i) {
        var text = item.content || '';
        var at = keyword ? text.toLowerCase().indexOf(keyword.toLowerCase()) : -1;
        var snippet = at >= 0 ? text.slice(Math.max(0, at - 30), at + 90) : text.slice(0, 110);
        return '<a class="search-result-item" href="' + escapeHtml(item.url) + '" data-index="' + i + '">' +
          '<p class="search-result-title">' + escapeHtml(item.title || '(untitled)') + '</p>' +
          '<p class="search-result-excerpt">' + escapeHtml(snippet) + '…</p>' +
          '<p class="search-result-meta">' + escapeHtml(item.date || '') +
          (item.categories && item.categories.length ? ' · ' + escapeHtml(item.categories.join(' / ')) : '') +
          '</p></a>';
      }).join('');
      cursor = -1;
    }

    function search(keyword) {
      ensureIndex().then(function (list) {
        var kw = (keyword || '').trim().toLowerCase();
        if (!kw) {
          results.innerHTML = '<p class="search-hint">' + escapeHtml(label('label-search-placeholder', 'Search…')) + '</p>';
          return;
        }
        var matched = list.filter(function (item) {
          return (item.title || '').toLowerCase().indexOf(kw) >= 0 ||
            (item.content || '').toLowerCase().indexOf(kw) >= 0 ||
            (item.categories || []).join(',').toLowerCase().indexOf(kw) >= 0 ||
            (item.tags || []).join(',').toLowerCase().indexOf(kw) >= 0;
        }).slice(0, 20);
        render(matched, keyword.trim());
      });
    }

    var timer = null;
    on(input, 'input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { search(input.value); }, 140);
    });

    on(openBtn, 'click', open);
    on(closeBtn, 'click', close);
    on(mask, 'click', close);
    on(document, 'keydown', function (event) {
      if (event.key === 'Escape' && !box.hidden) close();
      if (box.hidden) return;
      var items = $$('.search-result-item', results);
      if (!items.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        items.forEach(function (item) { item.classList.remove('is-active'); });
        cursor = (cursor + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[cursor].classList.add('is-active');
        items[cursor].scrollIntoView({ block: 'nearest' });
      } else if (event.key === 'Enter' && cursor >= 0) {
        window.location.href = items[cursor].getAttribute('href');
      }
    });
  }

  // -------------------------------------------------------------------------
  // 启动
  // -------------------------------------------------------------------------
  // 首屏入场：脚本位于 body 末尾，此时 HTML 已解析完，同步加 class 可让
  // 入场动画与首帧渲染同批次生效，避免「先隐藏再显示」的闪烁。
  if (document.querySelector('#hero')) {
    root.classList.add('hero-ready');
  }

  function boot() {
    initTheme();
    initHero();
    initScrollEffects();
    initNavDrawer();
    initReveal();
    initToc();
    initCopyCode();
    initLightbox();
    initSearch();
    root.classList.add('monish-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.Monish = {
    theme: theme,
    toast: toast,
    config: config
  };
})();
