/* ==========================================================================
   vectora — interaction layer
   Material Design 3 behaviors: state layers/ripples, tabs, carousel,
   theme switching, scroll-driven app bar, motion-safe reveals.
   ========================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------------------------------------------------------------- Theme */

  var THEME_KEY = "vectora-theme";
  var themeToggle = document.getElementById("themeToggle");
  var themeToggleIcon = document.getElementById("themeToggleIcon");
  var systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function currentTheme() {
    var explicit = root.getAttribute("data-theme");
    if (explicit) return explicit;
    return systemDark.matches ? "dark" : "light";
  }

  function syncThemeControl() {
    var dark = currentTheme() === "dark";
    if (themeToggleIcon) themeToggleIcon.textContent = dark ? "light_mode" : "dark_mode";
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(dark));
      themeToggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#14121c" : "#5f2ef4");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {}
      syncThemeControl();
    });
  }

  if (typeof systemDark.addEventListener === "function") {
    systemDark.addEventListener("change", function () {
      if (!root.hasAttribute("data-theme")) syncThemeControl();
    });
  }

  syncThemeControl();

  /* ----------------------------------------------------------- Icon font */

  var ICON_FONT = '24px "Material Symbols Rounded"';

  function markIconsReady(attempt) {
    if (!document.fonts || typeof document.fonts.check !== "function") {
      root.classList.add("icons-ready");
      return;
    }
    if (document.fonts.check(ICON_FONT)) {
      root.classList.add("icons-ready");
      return;
    }
    if (attempt < 3) {
      window.setTimeout(function () {
        markIconsReady(attempt + 1);
      }, 800);
    }
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      markIconsReady(0);
    });
    document.fonts.load(ICON_FONT).catch(function () {});
  } else {
    root.classList.add("icons-ready");
  }

  /* --------------------------------------------------------------- Ripple */

  document.addEventListener("pointerdown", function (event) {
    if (prefersReducedMotion.matches) return;
    var host = event.target.closest(".md-state-layer");
    if (!host) return;

    var rect = host.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 2.2;
    var ripple = document.createElement("span");
    ripple.className = "md-ripple";
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = event.clientX - rect.left - size / 2 + "px";
    ripple.style.top = event.clientY - rect.top - size / 2 + "px";
    host.appendChild(ripple);
    ripple.addEventListener("animationend", function () {
      ripple.remove();
    });
  });

  /* ------------------------------------------------- Top app bar on scroll */

  var topAppBar = document.getElementById("topAppBar");
  var backToTop = document.getElementById("backToTop");

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (topAppBar) topAppBar.setAttribute("data-scrolled", String(y > 8));
    if (backToTop) backToTop.setAttribute("data-visible", String(y > window.innerHeight * 0.75));
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion.matches ? "auto" : "smooth"
      });
    });
  }

  /* ------------------------------------------- Navigation active indicator */

  var primaryNav = document.getElementById("primaryNav");
  var navIndicator = document.getElementById("navIndicator");
  var navLinks = primaryNav ? Array.prototype.slice.call(primaryNav.querySelectorAll(".nav-link")) : [];
  var sheetLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-sheet__item"));

  function moveIndicator(link) {
    if (!navIndicator || !primaryNav) return;
    if (!link) {
      navIndicator.style.opacity = "0";
      return;
    }
    var navRect = primaryNav.getBoundingClientRect();
    var rect = link.getBoundingClientRect();
    navIndicator.style.opacity = "1";
    navIndicator.style.width = rect.width - 16 + "px";
    navIndicator.style.transform = "translateX(" + (rect.left - navRect.left + 8) + "px)";
  }

  function setActiveSection(id) {
    var active = null;
    navLinks.forEach(function (link) {
      var match = link.getAttribute("href") === "#" + id;
      if (match) {
        link.setAttribute("aria-current", "true");
        active = link;
      } else {
        link.removeAttribute("aria-current");
      }
    });
    sheetLinks.forEach(function (link) {
      if (link.getAttribute("href") === "#" + id) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    moveIndicator(active);
  }

  var trackedSections = ["services", "leadership", "testimonials", "contact"]
    .map(function (id) {
      return document.getElementById(id);
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && trackedSections.length) {
    var visible = new Map();
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        var best = null;
        var bestRatio = 0;
        visible.forEach(function (ratio, id) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        });
        setActiveSection(bestRatio > 0 ? best : null);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.4, 0.75, 1] }
    );
    trackedSections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }

  window.addEventListener("resize", function () {
    var active = navLinks.filter(function (link) {
      return link.getAttribute("aria-current") === "true";
    })[0];
    moveIndicator(active);
  });

  /* --------------------------------------------------- Modal nav (compact) */

  var navSheet = document.getElementById("navSheet");
  var navMenuButton = document.getElementById("navMenuButton");
  var lastFocused = null;

  function openNavSheet() {
    if (!navSheet) return;
    lastFocused = document.activeElement;
    navSheet.setAttribute("data-open", "true");
    if (navMenuButton) navMenuButton.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    var firstLink = navSheet.querySelector(".nav-sheet__item");
    if (firstLink) firstLink.focus({ preventScroll: true });
  }

  function closeNavSheet() {
    if (!navSheet || navSheet.getAttribute("data-open") !== "true") return;
    navSheet.setAttribute("data-open", "false");
    if (navMenuButton) navMenuButton.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus({ preventScroll: true });
  }

  if (navMenuButton) navMenuButton.addEventListener("click", openNavSheet);

  document.querySelectorAll("[data-nav-close]").forEach(function (element) {
    element.addEventListener("click", closeNavSheet);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeNavSheet();
      return;
    }

    // Keep focus inside the sheet while it is open (it is aria-modal).
    if (event.key !== "Tab" || !navSheet || navSheet.getAttribute("data-open") !== "true") return;

    var focusable = navSheet.querySelectorAll("a[href], button:not([disabled])");
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* ----------------------------------------------------------- Service tabs */

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".service-tab"));

  function selectTab(tab, moveFocus) {
    tabs.forEach(function (candidate) {
      var selected = candidate === tab;
      candidate.setAttribute("aria-selected", String(selected));
      candidate.setAttribute("tabindex", selected ? "0" : "-1");

      var panel = document.getElementById(candidate.getAttribute("aria-controls"));
      if (!panel) return;
      panel.hidden = !selected;
      panel.classList.remove("service-panel__enter");
      if (selected && !prefersReducedMotion.matches) {
        // Restart the enter animation on every switch.
        void panel.offsetWidth;
        panel.classList.add("service-panel__enter");
      }
    });
    if (moveFocus) tab.focus({ preventScroll: true });
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () {
      selectTab(tab, false);
    });

    tab.addEventListener("keydown", function (event) {
      var horizontal = window.matchMedia("(max-width: 899px)").matches;
      var nextKey = horizontal ? "ArrowRight" : "ArrowDown";
      var prevKey = horizontal ? "ArrowLeft" : "ArrowUp";
      var target = null;

      if (event.key === nextKey) target = tabs[(index + 1) % tabs.length];
      else if (event.key === prevKey) target = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === "Home") target = tabs[0];
      else if (event.key === "End") target = tabs[tabs.length - 1];

      if (target) {
        event.preventDefault();
        selectTab(target, true);
      }
    });
  });

  /* ------------------------------------------------------------- Typewriter */

  var typewriter = document.getElementById("typewriter");
  var words = ["Experts", "Engineers", "Clinicians", "Statisticians"];

  if (typewriter) {
    if (prefersReducedMotion.matches) {
      typewriter.textContent = words[0];
      var staticCursor = document.getElementById("typewriterCursor");
      if (staticCursor) staticCursor.style.display = "none";
    } else {
      var wordIndex = 0;
      var charIndex = 0;
      var typing = true;

      (function typeLoop() {
        var word = words[wordIndex];
        if (typing) {
          if (charIndex < word.length) {
            charIndex += 1;
            typewriter.textContent = word.slice(0, charIndex);
            setTimeout(typeLoop, 88);
          } else {
            typing = false;
            setTimeout(typeLoop, 1400);
          }
        } else if (charIndex > 0) {
          charIndex -= 1;
          typewriter.textContent = word.slice(0, charIndex);
          setTimeout(typeLoop, 38);
        } else {
          typing = true;
          wordIndex = (wordIndex + 1) % words.length;
          setTimeout(typeLoop, 380);
        }
      })();
    }
  }

  /* --------------------------------------------------------------- Carousel */

  var viewport = document.getElementById("testimonialsViewport");
  var controls = document.getElementById("carouselControls");
  var prevButton = document.getElementById("carouselPrev");
  var nextButton = document.getElementById("carouselNext");

  if (viewport && controls) {
    var updateControls = function () {
      var overflowing = viewport.scrollWidth - viewport.clientWidth > 8;
      controls.hidden = !overflowing;
      if (!overflowing) return;
      if (prevButton) prevButton.disabled = viewport.scrollLeft <= 4;
      if (nextButton) {
        nextButton.disabled = viewport.scrollLeft >= viewport.scrollWidth - viewport.clientWidth - 4;
      }
    };

    var step = function (direction) {
      var card = viewport.querySelector(".testimonial-card");
      var distance = card ? card.getBoundingClientRect().width + 20 : viewport.clientWidth * 0.8;
      viewport.scrollBy({
        left: direction * distance,
        behavior: prefersReducedMotion.matches ? "auto" : "smooth"
      });
    };

    if (prevButton) prevButton.addEventListener("click", function () { step(-1); });
    if (nextButton) nextButton.addEventListener("click", function () { step(1); });
    viewport.addEventListener("scroll", updateControls, { passive: true });
    window.addEventListener("resize", updateControls);
    updateControls();
  }

  /* ---------------------------------------------------------- Scroll reveal */

  var revealTargets = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));

  if (!("IntersectionObserver" in window) || prefersReducedMotion.matches) {
    revealTargets.forEach(function (element) {
      element.setAttribute("data-revealed", "true");
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-revealed", "true");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    revealTargets.forEach(function (element) {
      revealObserver.observe(element);
    });
  }

  /* --------------------------------------------------------------- Snackbar */

  var snackbar = document.getElementById("snackbar");
  var snackbarText = document.getElementById("snackbarText");
  var snackbarAction = document.getElementById("snackbarAction");
  var snackbarTimer = null;

  function hideSnackbar() {
    if (snackbar) snackbar.setAttribute("data-open", "false");
  }

  function showSnackbar(message) {
    if (!snackbar || !snackbarText) return;
    snackbarText.textContent = message;
    snackbar.setAttribute("data-open", "true");
    window.clearTimeout(snackbarTimer);
    snackbarTimer = window.setTimeout(hideSnackbar, 6000);
  }

  if (snackbarAction) snackbarAction.addEventListener("click", hideSnackbar);

  /* ----------------------------------------------------------- Contact form */

  var form = document.getElementById("contactForm");
  var dialog = document.getElementById("thankYouDialog");
  var dialogClose = document.getElementById("thankYouClose");
  var submitButton = document.getElementById("contactSubmit");
  var formStatus = document.getElementById("formStatus");

  if (dialogClose && dialog) {
    dialogClose.addEventListener("click", function () {
      dialog.close();
    });
  }

  if (dialog) {
    // Clicking the scrim closes the dialog.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
  }

  function openThankYou() {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else showSnackbar("Thanks! Your message has been sent.");
  }

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (submitButton) submitButton.disabled = true;
      if (formStatus) formStatus.textContent = "Sending…";

      try {
        var response = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" }
        });

        if (!response.ok) throw new Error("Request failed");

        form.reset();
        if (formStatus) formStatus.textContent = "";
        openThankYou();
      } catch (error) {
        if (formStatus) formStatus.textContent = "";
        showSnackbar("There was an error sending your message. Please try again later.");
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  /* ------------------------------------------------------- Hero animation */

  var heroMedia = document.getElementById("heroMedia");

  if (heroMedia) {
    window.setTimeout(function () {
      var player = heroMedia.querySelector("lottie-player");
      var rendered = player && (player.shadowRoot ? player.shadowRoot.querySelector("svg, canvas") : null);
      if (!rendered) heroMedia.setAttribute("data-lottie", "failed");
    }, 3000);
  }

  /* ------------------------------------------------------------------ Misc */

  var footerYear = document.getElementById("footerYear");
  if (footerYear) footerYear.textContent = String(new Date().getFullYear());
})();
