/* ============================================================
   ARAO — interactions (minimal)
   ============================================================ */
(function () {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Nav: shadow on scroll ── */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ── Mobile menu ── */
  const toggle = $("[data-nav-toggle]");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$(".nav__links a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
    })
  );

  /* ── Scroll spy ── */
  const sections = ["story", "compare", "profiles", "gallery", "install", "pricing"]
    .map((id) => $("#" + id))
    .filter(Boolean);
  const navLinks = $$(".nav__links a");
  if (sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const id = e.target.id;
            navLinks.forEach((a) =>
              a.classList.toggle("is-active", a.getAttribute("href") === "#" + id)
            );
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ═══ Before / After slider ═══ */
  const ba = $("[data-ba]");
  if (ba) {
    const before = $("[data-ba-before]", ba);
    const handle = $("[data-ba-handle]", ba);
    let dragging = false;

    const setPos = (pct) => {
      pct = Math.max(0, Math.min(100, pct));
      before.style.width = pct + "%";
      handle.style.left = pct + "%";
      handle.setAttribute("aria-valuenow", Math.round(pct));
    };
    const fromEvent = (clientX) => {
      const r = ba.getBoundingClientRect();
      setPos(((clientX - r.left) / r.width) * 100);
    };
    const start = (e) => { dragging = true; ba.style.cursor = "ew-resize"; fromEvent(e.touches ? e.touches[0].clientX : e.clientX); };
    const move  = (e) => { if (dragging) fromEvent(e.touches ? e.touches[0].clientX : e.clientX); };
    const end   = () => { dragging = false; ba.style.cursor = ""; };

    ba.addEventListener("mousedown", start);
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseup", end);
    ba.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end);

    handle.addEventListener("keydown", (e) => {
      const cur = parseFloat(handle.getAttribute("aria-valuenow")) || 50;
      if (e.key === "ArrowLeft")  { setPos(cur - 3); e.preventDefault(); }
      if (e.key === "ArrowRight") { setPos(cur + 3); e.preventDefault(); }
      if (e.key === "Home") { setPos(0); e.preventDefault(); }
      if (e.key === "End")  { setPos(100); e.preventDefault(); }
    });
  }

  /* ═══ Reusable lightbox ═══ */
  const lb = $("[data-lb]");
  let lbItems = [];   // active image list: { src, alt }
  let current = 0;
  let lastFocus = null;

  if (lb) {
    const lbImg   = $("[data-lb-img]", lb);
    const lbCount = $("[data-lb-count]", lb);

    const preload = (i) => {
      const s = lbItems[(i + lbItems.length) % lbItems.length];
      if (s) { const im = new Image(); im.src = s.src; }
    };
    const paint = () => {
      const s = lbItems[current];
      lbImg.src = s.src; lbImg.alt = s.alt || "";
      lbCount.textContent = `${current + 1} / ${lbItems.length}`;
    };
    const render = () => {
      lbImg.classList.add("is-swapping");
      if (reduceMotion) { paint(); lbImg.classList.remove("is-swapping"); }
      else { setTimeout(() => { paint(); lbImg.classList.remove("is-swapping"); }, 140); }
      preload(current + 1); preload(current - 1);
    };

    // exposed so any gallery can open the shared lightbox
    window.__araoLightbox = {
      open(items, i) {
        lbItems = items; current = i;
        lastFocus = document.activeElement;
        lb.classList.add("is-open");
        lb.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        paint();
        preload(current + 1); preload(current - 1);
        $("[data-lb-close]", lb)?.focus();
      }
    };
    const close = () => {
      lb.classList.remove("is-open");
      lb.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      lastFocus && lastFocus.focus();
    };
    const go = (dir) => {
      if (!lbItems.length) return;
      current = (current + dir + lbItems.length) % lbItems.length;
      render();
    };

    $("[data-lb-close]", lb).addEventListener("click", close);
    $("[data-lb-prev]", lb).addEventListener("click", () => go(-1));
    $("[data-lb-next]", lb).addEventListener("click", () => go(1));
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });

    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    });

    let touchX = null;
    lb.addEventListener("touchstart", (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
      touchX = null;
    }, { passive: true });
  }

  /* ═══ Sample photos grid ═══ */
  const shotsEl = $("[data-shots]");
  if (shotsEl && lb) {
    const SHOTS = Array.from({ length: 20 }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return { src: `assets/samples/sample-${n}.jpg`, alt: `Jeju sample photo ${i + 1}, shot with an ARAO color profile` };
    });
    SHOTS.forEach((s, i) => {
      const b = document.createElement("button");
      b.className = "shot";
      b.type = "button";
      b.setAttribute("aria-label", `View sample photo ${i + 1}`);
      const img = document.createElement("img");
      img.src = s.src; img.alt = s.alt; img.loading = "lazy"; img.decoding = "async";
      const no = document.createElement("span");
      no.className = "shot__no";
      no.textContent = String(i + 1).padStart(2, "0");
      b.append(img, no);
      b.addEventListener("click", () => window.__araoLightbox.open(SHOTS, i));
      shotsEl.appendChild(b);
    });
  }

  /* ═══ Gallery — show all photos ═══ */
  const galleryEl = $("[data-gallery]");
  if (galleryEl) {
    const TOTAL = 20;
    const items = Array.from({ length: TOTAL }, (_, i) => ({
      src: `assets/gallery/g-${String(i + 1).padStart(2, "0")}.jpg`,
      alt: `Jeju photo ${i + 1}, shot with an ARAO color profile`,
    }));

    galleryEl.innerHTML = "";
    items.forEach((it, i) => {
      const fig = document.createElement("figure");
      // vary tile sizes for a bento layout
      let size = "";
      if (i % 7 === 3) size = " gcell--tall";
      else if (i % 5 === 0) size = " gcell--wide";
      fig.className = "gcell" + size;
      fig.tabIndex = 0;
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", `View photo ${i + 1}`);
      const img = document.createElement("img");
      img.src = it.src; img.alt = it.alt; img.loading = "lazy"; img.decoding = "async";
      fig.appendChild(img);
      const openThis = () => lb && window.__araoLightbox.open(items, i);
      fig.addEventListener("click", openThis);
      fig.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openThis(); }
      });
      galleryEl.appendChild(fig);
    });
  }

  /* ── Newsletter (demo) ── */
  const form = $("[data-news]");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $("[data-news-msg]");
    msg.textContent = "Thanks — you're on the list.";
    form.reset();
  });
})();
