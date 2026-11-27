(function () {
  'use strict';

  /* Stabilan prelazak između stranica --------------------------------------
     Stranice se menjaju bez ponovnog učitavanja dokumenta, pa header i footer
     ostaju isti DOM i top bar bukvalno stoji na mestu. Ako fetch nije
     dostupan, linkovi i dalje rade kao obična navigacija. */
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var renderedUrl = new URL(window.location.href);
  var isNavigating = false;

  /* Trajanja prate CSS u `css/styles.css` (sekcija „Animacija prelaska
     sadržaja stranica“). Cleanup je duži od ulazne animacije i staggera. */
  var PAGE_OUT_DURATION = 170;
  var PAGE_IN_CLEANUP = 760;
  var PAGE_TRANSITION_KEY = 'negalink-page-transition';
  var pageTransitionToken = 0;

  function normalizePath(pathname) {
    return pathname.replace(/\/index\.html$/, '/') || '/';
  }

  function resolveUrl(link) {
    try {
      return new URL(link.href, window.location.href);
    } catch (error) {
      return null;
    }
  }

  function isInternalPage(url) {
    if (url.origin !== window.location.origin) {
      return false;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'file:') {
      return false;
    }

    return /\/$/.test(url.pathname) || /\.html?$/i.test(url.pathname);
  }

  function isSamePage(url) {
    return normalizePath(url.pathname) === normalizePath(window.location.pathname);
  }

  function scrollToTarget(target) {
    target.scrollIntoView({
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
    });
  }

  function updateActiveNav(url) {
    var currentPath = normalizePath(url.pathname);

    document
      .querySelectorAll('.header-nav .nav-link, .mobile-menu__link')
      .forEach(function (link) {
        var linkUrl = resolveUrl(link);
        var isActive = Boolean(linkUrl) && normalizePath(linkUrl.pathname) === currentPath;

        if (isActive) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
  }

  /* Smer animacije i animirani prelaz sadržaja ------------------------------ */
  function pageOrder(pathname) {
    if (/\/mogucnosti\.html$/.test(pathname)) {
      return 1;
    }

    /* Koren sajta ili index.html (i kada je sajt u podfolderu) je početna. */
    if (/\/(?:index\.html)?$/.test(pathname)) {
      return 0;
    }

    return -1;
  }

  function getPageDirection(fromUrl, toUrl) {
    var from = pageOrder(fromUrl.pathname);
    var to = pageOrder(toUrl.pathname);

    if (from === -1 || to === -1 || from === to) {
      return 'up';
    }

    return to > from ? 'forward' : 'backward';
  }

  /* file:// ne dozvoljava fetch, pa smer prenosimo kroz sessionStorage. */
  function rememberPageTransition(direction) {
    try {
      window.sessionStorage.setItem(PAGE_TRANSITION_KEY, direction);
    } catch (error) {
      /* Neki browseri blokiraju storage za file:// — tada ide podrazumevani smer. */
    }
  }

  function takePageTransitionDirection() {
    var direction = 'up';

    try {
      var stored = window.sessionStorage.getItem(PAGE_TRANSITION_KEY);
      window.sessionStorage.removeItem(PAGE_TRANSITION_KEY);

      if (stored === 'forward' || stored === 'backward' || stored === 'up') {
        direction = stored;
      }
    } catch (error) {
      /* Bez storage-a koristi se 'up'. */
    }

    return direction;
  }

  /* Stara strana kratko izbledi i pomeri se pre zamene <main>-a. */
  function animatePageOut(main, direction) {
    return new Promise(function (resolve) {
      if (!main || reduceMotion.matches) {
        resolve();
        return;
      }

      /* Poništava eventualni cleanup prethodne animacije. */
      pageTransitionToken += 1;

      main.setAttribute('data-page-direction', direction);
      main.classList.remove('is-page-entering', 'is-page-entered');
      main.classList.add('page-transition', 'is-page-leaving');

      var settled = false;
      var timer = window.setTimeout(finish, PAGE_OUT_DURATION + 90);

      function finish() {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timer);
        main.removeEventListener('transitionend', onTransitionEnd);
        resolve();
      }

      function onTransitionEnd(event) {
        if (event.target === main && event.propertyName === 'opacity') {
          finish();
        }
      }

      main.addEventListener('transitionend', onTransitionEnd);
    });
  }

  /* Nova strana se „sleže“ iz blagog pomeraja, uz stagger hero sadržaja. */
  function animatePageIn(main, direction) {
    if (!main || reduceMotion.matches) {
      return;
    }

    var token = ++pageTransitionToken;

    main.setAttribute('data-page-direction', direction);
    main.classList.remove('is-page-leaving');
    main.classList.add('page-transition', 'is-page-entering');

    /* Prvo se primeni početno stanje, pa tek onda prelaz ka konačnom. */
    void main.offsetWidth;

    window.requestAnimationFrame(function () {
      if (token !== pageTransitionToken) {
        return;
      }

      main.classList.remove('is-page-entering');
      main.classList.add('is-page-entered');
    });

    window.setTimeout(function () {
      if (token !== pageTransitionToken) {
        return;
      }

      main.classList.remove('page-transition', 'is-page-entered');
      main.removeAttribute('data-page-direction');
    }, PAGE_IN_CLEANUP);
  }

  /* Ikone su u SVG sprite-u van <main>-a. Pošto se menja samo <main>, iz nove
     strane preuzimamo simbole koji još ne postoje u trenutnom dokumentu. */
  function syncIconSprite(nextDocument) {
    var nextSprite = nextDocument.querySelector('.icon-sprite');
    var currentSprite = document.querySelector('.icon-sprite');

    if (!nextSprite) {
      return;
    }

    if (!currentSprite) {
      document.body.insertBefore(nextSprite, document.body.firstChild);
      return;
    }

    nextSprite.querySelectorAll('symbol[id]').forEach(function (symbol) {
      if (!document.getElementById(symbol.id)) {
        currentSprite.appendChild(symbol.cloneNode(true));
      }
    });
  }

  /* Sadržaj nove stranice --------------------------------------------------- */
  function renderPage(html, url, updateHistory, direction) {
    var nextDocument = new DOMParser().parseFromString(html, 'text/html');
    var nextMain = nextDocument.querySelector('main');
    var currentMain = document.querySelector('main');

    if (!nextMain || !currentMain) {
      return Promise.resolve(false);
    }

    return animatePageOut(currentMain, direction).then(function () {
      syncIconSprite(nextDocument);
      currentMain.replaceWith(nextMain);
      document.title = nextDocument.title;
      renderedUrl = url;

      /* Novi sadržaj kreće od vrha; eventualni #hash cilj dobija trenutni skok. */
      window.scrollTo(0, 0);

      if (updateHistory) {
        history.pushState(null, '', url.href);
      }

      updateActiveNav(url);
      initPage();
      animatePageIn(nextMain, direction);

      window.requestAnimationFrame(function () {
        var target = url.hash ? document.getElementById(url.hash.slice(1)) : null;

        if (target) {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }

        if (nextMain.focus) {
          nextMain.focus({ preventScroll: true });
        }
      });

      return true;
    });
  }

  function navigate(url, updateHistory) {
    if (isNavigating) {
      return;
    }

    isNavigating = true;

    var direction = getPageDirection(renderedUrl, url);

    /* file:// ne dozvoljava fetch, pa posle animiranog izlaza sledi klasična
       navigacija; nova strana se animira pri učitavanju (vidi dno fajla). */
    if (window.location.protocol === 'file:') {
      rememberPageTransition(direction);
      animatePageOut(document.querySelector('main'), direction).then(function () {
        window.location.assign(url.href);
      });
      return;
    }

    fetch(url.href, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.text();
      })
      .then(function (html) {
        return renderPage(html, url, updateHistory, direction);
      })
      .then(function (rendered) {
        if (!rendered) {
          window.location.assign(url.href);
        }
      })
      .catch(function () {
        window.location.assign(url.href);
      })
      .then(function () {
        isNavigating = false;
      });
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    var element = event.target instanceof Element ? event.target : null;
    var link = element ? element.closest('a[href]') : null;

    if (!link || link.classList.contains('skip-link')) {
      return;
    }

    if (link.hasAttribute('download') || (link.target && link.target !== '_self')) {
      return;
    }

    var url = resolveUrl(link);
    if (!url) {
      return;
    }

    /* Linkovi na istoj stranici: glatki skrol, bez promene dokumenta. */
    if (isSamePage(url)) {
      if (!url.hash || url.hash === '#') {
        event.preventDefault();
        scrollToTop();
        return;
      }

      var target = document.getElementById(url.hash.slice(1));
      if (!target) {
        return;
      }

      event.preventDefault();
      scrollToTarget(target);

      if (url.hash !== window.location.hash) {
        history.pushState(null, '', url.hash);
      }
      return;
    }

    /* Druga stranica: menja se samo <main>, header ostaje netaknut. */
    if (!isInternalPage(url)) {
      return;
    }

    event.preventDefault();
    navigate(url, true);
  });

  window.addEventListener('popstate', function () {
    var url = new URL(window.location.href);

    if (normalizePath(url.pathname) === normalizePath(renderedUrl.pathname)) {
      var target = url.hash ? document.getElementById(url.hash.slice(1)) : null;

      if (target) {
        scrollToTarget(target);
      } else {
        scrollToTop();
      }
      return;
    }

    if (!isInternalPage(url)) {
      window.location.reload();
      return;
    }

    navigate(url, false);
  });

  /* Godina u footeru ------------------------------------------------------ */
  var year = String(new Date().getFullYear());
  document.querySelectorAll('[data-current-year]').forEach(function (node) {
    node.textContent = year;
    if (node.tagName === 'TIME') {
      node.setAttribute('datetime', year);
    }
  });

  /* Mobilni meni ----------------------------------------------------------- */
  function initMobileMenu() {
    var toggle = document.querySelector('.menu-toggle');
    var menu = document.getElementById('mobile-nav');

    if (!toggle || !menu) {
      return;
    }

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Zatvori meni' : 'Otvori meni');
      menu.hidden = !open;
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setOpen(false);
      });
    });

    document.addEventListener('click', function (event) {
      if (toggle.getAttribute('aria-expanded') !== 'true') {
        return;
      }

      var target = event.target instanceof Element ? event.target : null;
      if (target && (toggle.contains(target) || menu.contains(target))) {
        return;
      }

      setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') {
        return;
      }

      if (toggle.getAttribute('aria-expanded') !== 'true') {
        return;
      }

      setOpen(false);
      toggle.focus();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 800 && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
      }
    });

    window.addEventListener('popstate', function () {
      setOpen(false);
    });
  }

  /* Izbor trenutka smene -------------------------------------------------- */
  function initMoments() {
    var moments = Array.prototype.slice.call(document.querySelectorAll('.moment'));
    var desktopDemo = document.getElementById('shift-demo');

    if (!moments.length || !desktopDemo) {
      return;
    }

    function activateMoment(activeMoment) {
      moments.forEach(function (moment) {
        var isActive = moment === activeMoment;
        moment.classList.toggle('is-active', isActive);
        moment.setAttribute('aria-pressed', String(isActive));
      });

      var wrapper = activeMoment.closest('.moment-wrap') || activeMoment.parentElement;
      var source = wrapper ? wrapper.querySelector('.mobile-demo .demo-screen') : null;
      if (!source) {
        return;
      }

      desktopDemo.innerHTML = '';
      desktopDemo.appendChild(source.cloneNode(true));
    }

    moments.forEach(function (moment) {
      moment.addEventListener('click', function () {
        activateMoment(moment);
      });
    });
  }

  /* Interaktivni prikazi unutar druge ilustracije smene ------------------- */
  function initShiftDemoViews() {
    var labels = {
      zadaci: 'Moji zadaci',
      raspored: 'Moj raspored',
      beleske: 'Beleške smene',
    };

    document.addEventListener('click', function (event) {
      var button =
        event.target instanceof Element ? event.target.closest('[data-shift-view]') : null;
      if (!button) {
        return;
      }

      var screen = button.closest('.demo-screen');
      if (!screen) {
        return;
      }

      var view = button.getAttribute('data-shift-view');
      var tabs = screen.querySelectorAll('[data-shift-view]');
      var panels = screen.querySelectorAll('[data-shift-panel]');

      if (!panels.length) {
        return;
      }

      tabs.forEach(function (tab) {
        var isActive = tab === button;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-pressed', String(isActive));
      });

      panels.forEach(function (panel) {
        var isActive = panel.getAttribute('data-shift-panel') === view;
        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      });

      if (labels[view]) {
        screen.setAttribute('aria-label', 'Ilustrativni prikaz: ' + labels[view]);
      }
    });
  }

  /* Kontakt / slanje upita (mailto) --------------------------------------- */
  function initForm() {
    var form = document.querySelector('.signup-form');
    if (!form) {
      return;
    }

    var homeName = form.elements.homeName;
    var email = form.elements.email;
    var success = form.querySelector('.form-success');
    var successLink = success ? success.querySelector('a') : null;
    var contactEmail = form.getAttribute('data-contact-email') || 'kontakt@negalink.rs';
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    var packageSummary = form.querySelector('[data-package-summary]');
    var packageName = form.querySelector('[data-package-name]');
    var packagePrice = form.querySelector('[data-package-price]');
    var packageInput = form.querySelector('[data-package-input]');
    var packageClear = form.querySelector('[data-package-clear]');
    var packageLinks = document.querySelectorAll('[data-package]');
    var selectedPackage = null;

    var fields = [
      {
        input: homeName,
        error: document.getElementById('home-name-error'),
        validate: function () {
          var value = homeName.value.trim();
          if (!value) {
            return 'Naziv doma je obavezan';
          }
          if (value.length < 2) {
            return 'Unesite najmanje 2 karaktera';
          }
          return '';
        },
      },
      {
        input: email,
        error: document.getElementById('email-error'),
        validate: function () {
          var value = email.value.trim();
          if (!value) {
            return 'Kontakt mejl je obavezan';
          }
          if (!emailPattern.test(value)) {
            return 'Unesite ispravnu email adresu';
          }
          return '';
        },
      },
    ];

    function setError(field, message) {
      field.error.textContent = message;
      field.error.hidden = !message;
      field.input.setAttribute('aria-invalid', String(Boolean(message)));

      if (message) {
        field.input.setAttribute('aria-describedby', field.error.id);
      } else {
        field.input.removeAttribute('aria-describedby');
      }
    }

    function validate() {
      var firstInvalid = null;

      fields.forEach(function (field) {
        var message = field.validate();
        setError(field, message);

        if (message && !firstInvalid) {
          firstInvalid = field.input;
        }
      });

      return firstInvalid;
    }

    function hideSuccess() {
      if (success) {
        success.hidden = true;
      }
    }

    function setPackage(name, price) {
      if (!name) {
        return;
      }

      selectedPackage = {
        name: name,
        price: price,
      };

      if (packageName) {
        packageName.textContent = name;
      }

      if (packagePrice) {
        packagePrice.textContent = price;
      }

      if (packageInput) {
        packageInput.value = name + (price ? ' — ' + price : '');
      }

      if (packageSummary) {
        packageSummary.hidden = false;
      }

      hideSuccess();
    }

    function clearPackage() {
      selectedPackage = null;

      if (packageSummary) {
        packageSummary.hidden = true;
      }

      if (packageInput) {
        packageInput.value = '';
      }

      hideSuccess();

      if (homeName) {
        homeName.focus({ preventScroll: true });
      }
    }

    fields.forEach(function (field) {
      field.input.addEventListener('input', function () {
        setError(field, '');
        hideSuccess();
      });
    });

    Array.prototype.forEach.call(packageLinks, function (link) {
      link.addEventListener('click', function () {
        setPackage(
          link.getAttribute('data-package') || '',
          link.getAttribute('data-package-price') || ''
        );
      });
    });

    if (packageClear) {
      packageClear.addEventListener('click', clearPackage);
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var firstInvalid = validate();
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      var bodyLines = [
        'Naziv doma: ' + homeName.value.trim(),
        'Kontakt mejl: ' + email.value.trim(),
      ];

      if (selectedPackage) {
        bodyLines.push(
          'Izabrani paket: ' +
            selectedPackage.name +
            (selectedPackage.price ? ' — ' + selectedPackage.price : '')
        );
      }

      bodyLines.push('', 'Želim da povežem svoj dom sa NegaLink-om.');

      var body = bodyLines.join('\n');
      var subject =
        'Upit za NegaLink — ' +
        homeName.value.trim() +
        (selectedPackage ? ' (' + selectedPackage.name + ')' : '');
      var href =
        'mailto:' +
        contactEmail +
        '?subject=' +
        encodeURIComponent(subject) +
        '&body=' +
        encodeURIComponent(body);

      if (success && successLink) {
        successLink.href = href;
        success.hidden = false;
      }

      window.location.href = href;
    });
  }

  /* Hero animacija: dodavanje beleške smene --------------------------------
     Ilustrativni demo u heroju „kuca“ belešku, pritiska „Dodaj belešku“ i
     ubacuje je u listu. Petlja se prekida pri promeni stranice, a uz
     prefers-reduced-motion se odmah prikazuje konačno stanje (bez petlje). */
  var heroDemoTimers = [];
  var heroDemoToken = 0;

  function stopHeroDemo() {
    heroDemoToken += 1;
    heroDemoTimers.forEach(function (timer) {
      window.clearTimeout(timer);
    });
    heroDemoTimers = [];
  }

  function initHeroDemo() {
    stopHeroDemo();

    var demo = document.querySelector('[data-hero-demo]');
    if (!demo || document.hidden) {
      return;
    }

    var slide = demo.closest('[data-hero-slide]');
    if (slide && !slide.classList.contains('is-active')) {
      return;
    }

    var typed = demo.querySelector('[data-typed-text]');
    var note = demo.querySelector('[data-new-note]');
    var noteText = demo.querySelector('[data-note-text]');
    var count = demo.querySelector('[data-note-count]');

    if (!typed || !note || !noteText || !count) {
      return;
    }

    var token = heroDemoToken;
    var message = noteText.textContent.replace(/\s+/g, ' ').trim();
    var typedText = '';
    var index = 0;

    function schedule(callback, delay) {
      var timer = window.setTimeout(function () {
        if (token === heroDemoToken) {
          callback();
        }
      }, delay);
      heroDemoTimers.push(timer);
    }

    function reset() {
      typedText = '';
      index = 0;
      typed.textContent = '';
      note.classList.remove('is-visible');
      count.textContent = '1';
      demo.classList.remove('is-focused', 'is-typing', 'is-pressed', 'is-sent');
    }

    function showResult() {
      typed.textContent = '';
      note.classList.add('is-visible');
      count.textContent = '2';
      demo.classList.remove('is-focused', 'is-typing', 'is-pressed');
      demo.classList.add('is-sent');
      count.classList.add('is-bumped');
      schedule(function () {
        count.classList.remove('is-bumped');
      }, 500);
    }

    reset();

    if (reduceMotion.matches) {
      showResult();
      return;
    }

    function typeNext() {
      if (index >= message.length) {
        schedule(function () {
          demo.classList.add('is-pressed');
        }, 320);

        schedule(showResult, 520);

        /* Kratko zadržavanje rezultata, pa reset i nova petlja. */
        schedule(function () {
          note.classList.remove('is-visible');
          count.textContent = '1';
          demo.classList.remove('is-sent');

          schedule(function () {
            typed.textContent = '';
            typedText = '';
            index = 0;
            demo.classList.add('is-focused', 'is-typing');
            schedule(typeNext, 180);
          }, 640);
        }, 5200);

        return;
      }

      typedText += message.charAt(index);
      index += 1;
      typed.textContent = typedText;
      schedule(typeNext, message.charAt(index) === ' ' ? 46 : 24);
    }

    schedule(function () {
      demo.classList.add('is-focused');
    }, 650);

    schedule(function () {
      demo.classList.add('is-typing');
      /* Placeholder prvo izbledi (0.15s), pa počinje kucanje. */
      schedule(typeNext, 180);
    }, 1150);
  }

  /* Admin dashboard animacija: pregled beleški smene -----------------------
     Panel „Beleške smene“ se otvori, skeleton zameni lista beleški, a važna
     beleška se kratko istakne. Petlja se prekida pri promeni slajda/stranice;
     uz prefers-reduced-motion prikazuje se odmah konačno stanje. */
  var adminDemoTimers = [];
  var adminDemoToken = 0;

  function stopAdminDemo() {
    adminDemoToken += 1;
    adminDemoTimers.forEach(function (timer) {
      window.clearTimeout(timer);
    });
    adminDemoTimers = [];
  }

  function initAdminDemo() {
    stopAdminDemo();

    /* Dok je vođena kursor tura aktivna, ona upravlja notes panelom. */
    if (ckitiTourIsRunning) {
      return;
    }

    var demo = document.querySelector('[data-admin-demo]');
    if (!demo || document.hidden) {
      return;
    }

    var slide = demo.closest('[data-hero-slide]');
    if (slide && !slide.classList.contains('is-active')) {
      return;
    }

    var notes = demo.querySelector('[data-admin-notes]');
    var skeleton = demo.querySelector('[data-admin-skeleton]');
    var list = demo.querySelector('[data-admin-notes-list]');
    var firstNote = demo.querySelector('[data-admin-note]');

    if (!notes || !skeleton || !list || !firstNote) {
      return;
    }

    var token = adminDemoToken;

    function schedule(callback, delay) {
      var timer = window.setTimeout(function () {
        if (token === adminDemoToken) {
          callback();
        }
      }, delay);
      adminDemoTimers.push(timer);
    }

    function reset() {
      notes.classList.remove('is-expanded', 'is-clicking');
      skeleton.classList.remove('is-hidden');
      list.classList.remove('is-visible');
      firstNote.classList.remove('is-highlighted');
    }

    function showFinal() {
      notes.classList.add('is-expanded');
      skeleton.classList.add('is-hidden');
      list.classList.add('is-visible');
      firstNote.classList.add('is-highlighted');
    }

    function run() {
      reset();

      if (
        reduceMotion.matches ||
        window.matchMedia('(max-width: 800px)').matches
      ) {
        showFinal();
        return;
      }

      schedule(function () {
        notes.classList.add('is-clicking');
      }, 550);

      schedule(function () {
        notes.classList.remove('is-clicking');
        notes.classList.add('is-expanded');
      }, 1000);

      schedule(function () {
        skeleton.classList.add('is-hidden');
        list.classList.add('is-visible');
      }, 1700);

      schedule(function () {
        firstNote.classList.add('is-highlighted');
      }, 2400);

      schedule(function () {
        notes.classList.remove('is-expanded', 'is-clicking');
        list.classList.remove('is-visible');
        firstNote.classList.remove('is-highlighted');

        schedule(function () {
          skeleton.classList.remove('is-hidden');
          schedule(run, 200);
        }, 750);
      }, 7000);
    }

    run();
  }

  /* Ckiti tura: simulirani macOS kursor ------------------------------------
     Kursor se kreće kroz admin pregled, „klikće“ KPI kartice (Popunjenost,
     Zadaci danas, Potrebne akcije) i vraća se na pregled doma. Tura se
     pauzira na svaku korisničku interakciju i nastavlja se posle 10 s
     mirovanja; uz prefers-reduced-motion i na mobilnom se ne pokreće. */
  var ckitiTourInstance = null;
  var ckitiTourIsRunning = false;

  function stopCkitiTour() {
    if (ckitiTourInstance) {
      ckitiTourInstance.stop();
    }
  }

  function startCkitiTour() {
    if (ckitiTourInstance) {
      ckitiTourInstance.start();
    }
  }

  function createCkitiTour(carousel, slides, render) {
    var cursor = carousel.querySelector('[data-ckiti-cursor]');
    var adminIndex = -1;
    var targetKeys = ['stats', 'tasks', 'actions'];
    var timers = [];
    var runToken = 0;
    var resumeTimer = null;
    var resumeDelay = 10000;
    var moveDuration = 880;

    slides.forEach(function (slide, index) {
      if (slide.getAttribute('data-hero-slide') === 'admin') {
        adminIndex = index;
      }
    });

    if (!cursor || adminIndex === -1) {
      return null;
    }

    function slideIndex(key) {
      var found = -1;

      slides.forEach(function (slide, index) {
        if (slide.getAttribute('data-hero-slide') === key) {
          found = index;
        }
      });

      return found;
    }

    function clearTimers() {
      runToken += 1;
      timers.forEach(function (timer) {
        window.clearTimeout(timer);
      });
      timers = [];
    }

    function schedule(callback, delay) {
      var token = runToken;
      var timer = window.setTimeout(function () {
        if (token === runToken) {
          callback();
        }
      }, delay);
      timers.push(timer);
    }

    function isAdminActive() {
      return slides[adminIndex].classList.contains('is-active');
    }

    function isEnabled() {
      return !reduceMotion.matches && !document.hidden;
    }

    function clearHighlightedStates() {
      carousel
        .querySelectorAll('.is-ckiti-hinted, .is-ckiti-pressed')
        .forEach(function (element) {
          element.classList.remove('is-ckiti-hinted', 'is-ckiti-pressed');
        });
    }

    function clearStates() {
      clearHighlightedStates();
      cursor.classList.remove('is-visible', 'is-pressing', 'is-clicking');
    }

    function restPoint(slide) {
      var demo = slide.querySelector('.hero-demo') || slide;
      var carouselRect = carousel.getBoundingClientRect();
      var rect = demo.getBoundingClientRect();

      return {
        x: Math.round(rect.left - carouselRect.left + rect.width * 0.44),
        y: Math.round(rect.top - carouselRect.top + rect.height * 0.78),
      };
    }

    function targetPoint(element) {
      var carouselRect = carousel.getBoundingClientRect();
      var rect = element.getBoundingClientRect();

      return {
        x: Math.round(rect.left - carouselRect.left + rect.width / 2),
        y: Math.round(rect.top - carouselRect.top + rect.height / 2),
      };
    }

    function placeCursor(point, visible) {
      cursor.classList.add('is-instant');
      cursor.style.transform = 'translate3d(' + point.x + 'px, ' + point.y + 'px, 0)';
      cursor.classList.toggle('is-visible', Boolean(visible));

      /* Pročitaj layout da bi sledeći prelaz krenuo sa nove pozicije. */
      void cursor.offsetWidth;
      cursor.classList.remove('is-instant');
    }

    function moveCursorToPoint(point) {
      window.requestAnimationFrame(function () {
        cursor.classList.add('is-visible');
        cursor.style.transform = 'translate3d(' + point.x + 'px, ' + point.y + 'px, 0)';
      });
    }

    function moveCursorTo(element) {
      moveCursorToPoint(targetPoint(element));
    }

    /* Ako je kursor već na ekranu, glatko prelazi na novu tačku; inače se
       pojavljuje tačno na njoj (prvi prikaz). */
    function showCursorAt(point) {
      if (cursor.classList.contains('is-visible')) {
        moveCursorToPoint(point);
      } else {
        placeCursor(point, true);
      }
    }

    function clickPulse() {
      cursor.classList.remove('is-clicking');
      void cursor.offsetWidth;
      cursor.classList.add('is-clicking');
    }

    function press(element) {
      element.classList.add('is-ckiti-pressed');
      cursor.classList.add('is-pressing');
      clickPulse();
    }

    function release(element) {
      element.classList.remove('is-ckiti-pressed');
      cursor.classList.remove('is-pressing');
    }

    /* Notes panelom upravlja tura dok je aktivna (admin demo tada miruje). */
    function resetNotes() {
      var adminSlide = slides[adminIndex];
      var notes = adminSlide.querySelector('[data-admin-notes]');
      var skeleton = adminSlide.querySelector('[data-admin-skeleton]');
      var list = adminSlide.querySelector('[data-admin-notes-list]');
      var firstNote = adminSlide.querySelector('[data-admin-note]');

      if (notes) {
        notes.classList.remove('is-expanded', 'is-clicking');
      }

      if (skeleton) {
        skeleton.classList.remove('is-hidden');
      }

      if (list) {
        list.classList.remove('is-visible');
      }

      if (firstNote) {
        firstNote.classList.remove('is-highlighted');
      }
    }

    /* Tačka koju kursor „čita“ na detaljnom prikazu. */
    function viewTarget(slide, key) {
      var selectors = {
        stats: '.ckiti-rstats__donut-svg',
        tasks: '.ckiti-tasks__bar',
        actions: '.ckiti-action--critical',
      };
      var target = slide.querySelector(selectors[key] || '');

      return target || slide.querySelector('.hero-demo') || slide;
    }

    function runStep(stepIndex) {
      if (stepIndex >= targetKeys.length) {
        /* Kraj kruga: kratka pauza, pa sve ponovo od pregleda doma. */
        schedule(function () {
          start();
        }, 2800);
        return;
      }

      var key = targetKeys[stepIndex];
      var targetIndex = slideIndex(key);
      var adminSlide = slides[adminIndex];
      var button = adminSlide.querySelector('[data-ckiti-target="' + key + '"]');

      if (!button || targetIndex === -1) {
        runStep(stepIndex + 1);
        return;
      }

      if (!isAdminActive()) {
        render(adminIndex, false, false);
        showCursorAt(restPoint(adminSlide));
      }

      /* Kursor ostaje vidljiv i kreće se pravo ka sledećoj KPI kartici. */
      button.classList.add('is-ckiti-hinted');

      schedule(function () {
        moveCursorTo(button);
      }, 120);

      var pressAt = 120 + moveDuration + 220;

      schedule(function () {
        button.classList.remove('is-ckiti-hinted');
        press(button);
      }, pressAt);

      schedule(function () {
        render(targetIndex, false, false);
        release(button);
        resetNotes();

        /* Kursor nastavlja da se kreće kroz detaljni prikaz. */
        var detailSlide = slides[targetIndex];

        schedule(function () {
          moveCursorTo(viewTarget(detailSlide, key));
        }, 600);
      }, pressAt + 170);

      /* Kratko zadržavanje detaljnog prikaza, pa povratak na pregled. */
      schedule(function () {
        openBack(stepIndex, targetIndex);
      }, pressAt + 170 + 3400);
    }

    function openBack(stepIndex, targetIndex) {
      var slide = slides[targetIndex];
      var back = slide.querySelector('.ckiti__back');

      if (!back) {
        render(adminIndex, false, false);
        schedule(function () {
          runStep(stepIndex + 1);
        }, 1400);
        return;
      }

      back.classList.add('is-ckiti-hinted');

      schedule(function () {
        moveCursorTo(back);
      }, 120);

      var pressAt = 120 + moveDuration + 220;

      schedule(function () {
        back.classList.remove('is-ckiti-hinted');
        press(back);
      }, pressAt);

      schedule(function () {
        render(adminIndex, false, false);
        release(back);
      }, pressAt + 170);

      schedule(function () {
        runStep(stepIndex + 1);
      }, pressAt + 170 + 1300);
    }

    /* Otvaranje „Beleški smene“: kursor klikće zaglavlje panela, panel se
       otvori, skeleton zameni lista i prva beleška se istakne. */
    function openNotesStep() {
      var adminSlide = slides[adminIndex];
      var notes = adminSlide.querySelector('[data-admin-notes]');
      var toggle = adminSlide.querySelector('[data-admin-notes-toggle]');
      var skeleton = adminSlide.querySelector('[data-admin-skeleton]');
      var list = adminSlide.querySelector('[data-admin-notes-list]');
      var firstNote = adminSlide.querySelector('[data-admin-note]');

      if (!notes || !toggle) {
        runStep(0);
        return;
      }

      resetNotes();
      toggle.classList.add('is-ckiti-hinted');
      moveCursorTo(toggle);

      var pressAt = 120 + moveDuration + 220;

      schedule(function () {
        toggle.classList.remove('is-ckiti-hinted');
        toggle.classList.add('is-ckiti-pressed');
        cursor.classList.add('is-pressing');
        clickPulse();
        notes.classList.add('is-clicking');
      }, pressAt);

      schedule(function () {
        toggle.classList.remove('is-ckiti-pressed');
        cursor.classList.remove('is-pressing');
        notes.classList.remove('is-clicking');
        notes.classList.add('is-expanded');
      }, pressAt + 150);

      schedule(function () {
        if (skeleton) {
          skeleton.classList.add('is-hidden');
        }

        if (list) {
          list.classList.add('is-visible');
        }
      }, pressAt + 700);

      schedule(function () {
        if (firstNote) {
          firstNote.classList.add('is-highlighted');
        }
      }, pressAt + 1100);

      /* Kratko čitanje beleški, pa prelazak na prvu KPI karticu. */
      schedule(function () {
        runStep(0);
      }, pressAt + 1900);
    }

    function stop(keepCursor) {
      ckitiTourIsRunning = false;
      clearTimers();

      if (keepCursor) {
        /* Interni restart (novi krug) — kursor ostaje na ekranu. */
        clearHighlightedStates();
        cursor.classList.remove('is-pressing', 'is-clicking');
      } else {
        clearStates();
      }

      if (resumeTimer) {
        window.clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    }

    function start() {
      stop(true);

      if (!isEnabled()) {
        return;
      }

      ckitiTourIsRunning = true;
      stopAdminDemo();

      if (!isAdminActive()) {
        render(adminIndex, false, false);
      }

      /* Kursor se odmah pojavi i ostaje vidljiv tokom cele ture. */
      showCursorAt(restPoint(slides[adminIndex]));

      schedule(function () {
        openNotesStep();
      }, 800);
    }

    function pause() {
      stop();

      /* Korisnik preuzima kontrolu — admin demo ponovo vodi notes panel. */
      if (isAdminActive()) {
        restartActiveHeroDemo();
      }

      resumeTimer = window.setTimeout(function () {
        resumeTimer = null;

        if (!document.hidden) {
          start();
        }
      }, resumeDelay);
    }

    return {
      start: start,
      stop: stop,
      pause: pause,
    };
  }

  /* Hero carousel: admin pregled (01) i dodavanje beleške (02) -------------- */
  function restartActiveHeroDemo() {
    stopHeroDemo();
    stopAdminDemo();

    var activeSlide = document.querySelector('[data-hero-slide].is-active');
    if (!activeSlide) {
      return;
    }

    if (activeSlide.getAttribute('data-hero-slide') === 'admin') {
      initAdminDemo();
    }
  }

  function initHeroCarousel() {
    stopHeroDemo();
    stopAdminDemo();
    stopCkitiTour();

    ckitiTourInstance = null;
    ckitiTourIsRunning = false;

    var carousel = document.querySelector('[data-hero-carousel]');
    if (!carousel) {
      return;
    }

    var slides = Array.prototype.slice.call(carousel.querySelectorAll('[data-hero-slide]'));
    var prev = carousel.querySelector('[data-hero-prev]');
    var next = carousel.querySelector('[data-hero-next]');
    var counter = carousel.querySelector('[data-hero-counter]');
    var live = carousel.querySelector('[data-hero-live]');

    if (!slides.length) {
      return;
    }

    var activeIndex = 0;

    slides.forEach(function (slide, index) {
      if (slide.classList.contains('is-active')) {
        activeIndex = index;
      }
    });

    function pad(value) {
      return value < 10 ? '0' + value : String(value);
    }

    function render(index, announce, moveFocus) {
      activeIndex = (index + slides.length) % slides.length;

      slides.forEach(function (slide, slideIndex) {
        var isActive = slideIndex === activeIndex;
        slide.classList.toggle('is-active', isActive);

        if (isActive) {
          slide.removeAttribute('hidden');
        } else {
          slide.setAttribute('hidden', '');
        }
      });

      if (counter) {
        counter.textContent = pad(activeIndex + 1) + ' / ' + pad(slides.length);
      }

      if (announce && live) {
        var label = slides[activeIndex].getAttribute('data-hero-label');
        live.textContent =
          'Prikaz ' + (activeIndex + 1) + ' od ' + slides.length + (label ? ': ' + label : '') + '.';
      }

      restartActiveHeroDemo();

      if (moveFocus) {
        var activeSlide = slides[activeIndex];
        var focusTarget =
          activeSlide.querySelector('.ckiti__back') ||
          activeSlide.querySelector('[data-ckiti-target]');

        if (focusTarget) {
          focusTarget.focus({ preventScroll: true });
        }
      }
    }

    if (prev) {
      prev.addEventListener('click', function () {
        render(activeIndex - 1, true, false);
      });
    }

    if (next) {
      next.addEventListener('click', function () {
        render(activeIndex + 1, true, false);
      });
    }

    var ckitiButtons = carousel.querySelectorAll('[data-ckiti-target]');
    Array.prototype.forEach.call(ckitiButtons, function (button) {
      button.addEventListener('click', function () {
        var target = button.getAttribute('data-ckiti-target');
        var targetIndex = -1;

        slides.forEach(function (slide, index) {
          if (slide.getAttribute('data-hero-slide') === target) {
            targetIndex = index;
          }
        });

        if (targetIndex !== -1) {
          render(targetIndex, true, true);
        }
      });
    });

    /* Svaka korisnička interakcija pauzira vođenu turu kursora. */
    function interruptTour() {
      if (ckitiTourInstance) {
        ckitiTourInstance.pause();
      }
    }

    carousel.addEventListener('pointerdown', interruptTour);
    carousel.addEventListener('focusin', interruptTour);
    carousel.addEventListener('keydown', interruptTour);

    carousel.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        render(activeIndex - 1, true, true);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        render(activeIndex + 1, true, true);
      }
    });

    /* Tura se priprema pre prvog rendera da admin demo ne bi otvorio beleške
       pre nego što ih kursor klikne (važi i za mobilni prikaz). */
    ckitiTourInstance = createCkitiTour(carousel, slides, render);
    ckitiTourIsRunning = Boolean(ckitiTourInstance) && !reduceMotion.matches;

    render(activeIndex, false, false);

    if (ckitiTourInstance) {
      ckitiTourInstance.start();
    } else {
      ckitiTourIsRunning = false;
    }
  }

  /* Inicijalizacija stranice (ponovo se poziva posle svake promene) --------- */
  function initPage() {
    initHeroCarousel();
    initMoments();
    initForm();
  }

  initMobileMenu();
  initShiftDemoViews();
  initPage();

  /* Hero animacije prate promenu preferencije i vidljivost taba. */
  function handleMotionPreferenceChange() {
    if (reduceMotion.matches) {
      stopCkitiTour();
      restartActiveHeroDemo();
    } else {
      startCkitiTour();

      if (!ckitiTourIsRunning) {
        restartActiveHeroDemo();
      }
    }
  }

  if (typeof reduceMotion.addEventListener === 'function') {
    reduceMotion.addEventListener('change', handleMotionPreferenceChange);
  } else if (typeof reduceMotion.addListener === 'function') {
    reduceMotion.addListener(handleMotionPreferenceChange);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopHeroDemo();
      stopAdminDemo();
      stopCkitiTour();
    } else {
      startCkitiTour();

      if (!ckitiTourIsRunning) {
        restartActiveHeroDemo();
      }
    }
  });

  /* Kada se HTML otvori direktno preko file://, nema soft navigacije, pa se
     ulazna animacija pokreće pri učitavanju dokumenta. */
  if (window.location.protocol === 'file:') {
    animatePageIn(document.querySelector('main'), takePageTransitionDirection());
  }
})();
