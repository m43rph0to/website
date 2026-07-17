document.addEventListener('DOMContentLoaded', () => {
    const currentYear = document.getElementById('currentYear');
    if (currentYear) currentYear.textContent = new Date().getFullYear();

    const gallery = document.getElementById('gallery');
    const loader = document.getElementById('gallery-loader');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxBuffer = document.getElementById('lightbox-img-buffer');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');
    const navButtons = document.querySelectorAll('.nav-btn');
    const galleryEmpty = document.getElementById('gallery-empty');
    const galleryEmptyContactToggle = document.getElementById('galleryEmptyContactToggle');
    const galleryEmptyContactOptions = document.getElementById('galleryEmptyContactOptions');

    // === GENRES NAVIGATION ===
    const genreConfig = {
        'img/gallery/reportage/': {
            altPool: [
                "Репортажная фотография с мероприятия",
                "Кадр из репортажной съёмки события",
                "Один из моментов мероприятия",
                "Живой эпизод во время события",
                "Атмосфера мероприятия в кадре",
                "Участники события во время мероприятия",
                "Гости мероприятия в естественной обстановке",
                "Эмоции людей во время события",
                "Общение участников мероприятия",
                "Люди в пространстве события",
                "Непостановочный кадр с мероприятия",
                "Сцена из жизни мероприятия",
                "Фрагмент репортажа о событии",
                "Момент публичного мероприятия",
                "Репортажный кадр с участниками события",
                "Детали обстановки на мероприятии",
                "Момент во время выступления",
                "Зрители и участники мероприятия",
                "Событие глазами репортажного фотографа",
                "Фотография из репортажного портфолио"
            ]
        },
        'img/gallery/portrait/': {
            altPool: [
                "none",
                "none"
            ]
        },
        'img/gallery/interior/': {
            altPool: [
                "none",
                "none"
            ]
            
        },
        'img/gallery/wedding/': {
            altPool: [
                "none",
                "none"
            ]
        },
        'img/gallery/studio/': {
            altPool: [
                "none",
                "none"
            ]
        }
    };

    let currentFolder = 'img/gallery/reportage/';
    let loadSession = 0;
    let resizeTimer;
    let nextRevealAt = 0;
    let lightboxOrder = [];
    let currentLightboxIndex = -1;
    let swipeStartX = null;
    let swipeStartY = null;
    let lightboxTransitioning = false;
    let lightboxAnimationToken = 0;
    let lightboxHistoryActive = false;
    let ignoreNextLightboxPopstate = false;
    const loadedLightboxSources = new Set();
    const lightboxAltBySource = new Map();
    const MAX_ERRORS = 5;
    const DISCOVERY_BATCH_SIZE = 10;
    const INITIAL_DISCOVERY_BATCH_SIZE = 30;
    const FAVORITE_RANKS = [1, 2, 3];
    const REVEAL_STEP = 90;

    // Получение случайного описания из пула текущего жанра
    function getAltText(folderPath) {
        const config = genreConfig[folderPath];
        if (!config || !config.altPool.length) return "Фотография из портфолио";
        return config.altPool[Math.floor(Math.random() * config.altPool.length)];
    }

    // Перемешивание без изменения исходного массива
    function shuffle(items) {
        const result = [...items];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    function getColumnCount() {
        if (window.innerWidth <= 600) return 1;
        if (window.innerWidth <= 800) return 2;
        return 3;
    }

    // Верхний ряд заполняется слева направо, остальные кадры идут в самый короткий столбец.
    function layoutPhotos() {
        const photos = Array.from(gallery.querySelectorAll('.photo'));
        if (photos.length === 0) {
            gallery.style.height = '';
            return;
        }

        const styles = getComputedStyle(gallery);
        const rootStyles = getComputedStyle(document.documentElement);
        const paddingLeft = parseFloat(styles.paddingLeft) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const gap = parseFloat(rootStyles.getPropertyValue('--gap')) || 10;
        const columnCount = getColumnCount();
        const contentWidth = gallery.clientWidth - paddingLeft - paddingRight;
        const columnWidth = (contentWidth - gap * (columnCount - 1)) / columnCount;
        const columnHeights = Array(columnCount).fill(paddingTop);

        photos.forEach((photo, index) => {
            const image = photo.querySelector('img');
            if (!image || !image.naturalWidth || !image.naturalHeight) return;

            const columnIndex = index < columnCount
                ? index
                : columnHeights.indexOf(Math.min(...columnHeights));
            const photoHeight = columnWidth * image.naturalHeight / image.naturalWidth;
            const x = paddingLeft + columnIndex * (columnWidth + gap);
            const y = columnHeights[columnIndex];

            photo.style.width = `${columnWidth}px`;
            photo.style.height = `${photoHeight}px`;
            photo.style.left = `${x}px`;
            photo.style.top = `${y}px`;
            photo.dataset.column = columnIndex;
            columnHeights[columnIndex] += photoHeight + gap;
        });

        const contentHeight = Math.max(...columnHeights) - gap + paddingBottom;
        gallery.style.height = `${Math.max(0, contentHeight)}px`;
    }

    function createPhotoBlock(photoItem, image, folderPath) {
        const div = document.createElement('div');
        div.className = 'photo';
        image.alt = getAltText(folderPath);
        image.decoding = 'async';
        image.dataset.src = photoItem.lightboxSrc;
        loadedLightboxSources.add(photoItem.lightboxSrc);
        lightboxAltBySource.set(photoItem.lightboxSrc, image.alt);
        div.appendChild(image);
        gallery.appendChild(div);

        updateLightboxControls();

        layoutPhotos();

        const now = Date.now();
        const revealAt = Math.max(now, nextRevealAt);
        const revealDelay = revealAt - now;
        nextRevealAt = revealAt + REVEAL_STEP;

        setTimeout(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => div.classList.add('visible'));
            });
        }, revealDelay);

        if (loader) loader.classList.add('hidden');
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.decoding = 'async';
            image.onload = async () => {
                try {
                    if (typeof image.decode === 'function') await image.decode();
                } catch (error) {
                    // load уже подтвердил корректность файла; старые браузеры могут отклонить decode().
                }
                resolve(image);
            };
            image.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
            image.src = src;
        });
    }

    // Проверка существования файла без загрузки всего изображения
    async function fileExists(src) {
        try {
            const response = await fetch(src, { method: 'HEAD', cache: 'no-store' });
            if (response.status !== 405 && response.status !== 501) {
                return response.ok;
            }
        } catch (error) {
            return false;
        }

        try {
            const response = await fetch(src, {
                method: 'GET',
                headers: { Range: 'bytes=0-0' },
                cache: 'no-store'
            });
            if (response.body) await response.body.cancel();
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // Суффиксы -orig-fav1, -orig-fav2 и -orig-fav3 проверяются только вместо
    // отсутствующего файла -orig. Закреплённый файл служит большой версией.
    async function findFavoriteVariant(basePath, previewSrc) {
        const variants = FAVORITE_RANKS.map(rank => ({
            lightboxSrc: `${basePath}-orig-fav${rank}.webp`,
            favoriteRank: rank
        }));
        const results = await Promise.all(variants.map(async variant => ({
            ...variant,
            exists: await fileExists(variant.lightboxSrc)
        })));
        const found = results.find(result => result.exists);
        return found ? {
            previewSrc,
            lightboxSrc: found.lightboxSrc,
            favoriteRank: found.favoriteRank
        } : null;
    }

    // Поиск пар 010-small.webp / 010-orig.webp и вариантов 020-orig-fav1.webp.
    // Превью является обязательным: без него кадр в галерею не добавляется.
    async function discoverPhotoPaths(folderPath, sessionId) {
        const paths = [];
        let nextNumber = 10;
        let errorsCount = 0;
        let firstBatch = true;

        while (errorsCount < MAX_ERRORS && sessionId === loadSession) {
            const batchSize = firstBatch
                ? INITIAL_DISCOVERY_BATCH_SIZE
                : DISCOVERY_BATCH_SIZE;
            const candidates = Array.from({ length: batchSize }, (_, index) => {
                const number = nextNumber + index * 10;
                const fileName = String(number).padStart(3, '0');
                return `${folderPath}${fileName}`;
            });

            const previewResults = await Promise.all(candidates.map(async basePath => ({
                basePath,
                previewSrc: `${basePath}-small.webp`,
                exists: await fileExists(`${basePath}-small.webp`)
            })));
            const results = await Promise.all(previewResults.map(async result => {
                if (!result.exists) return null;

                const originalSrc = `${result.basePath}-orig.webp`;
                if (await fileExists(originalSrc)) {
                    return {
                        previewSrc: result.previewSrc,
                        lightboxSrc: originalSrc,
                        favoriteRank: null
                    };
                }

                return findFavoriteVariant(result.basePath, result.previewSrc);
            }));

            for (const result of results) {
                if (sessionId !== loadSession) return [];

                if (result) {
                    paths.push(result);
                    errorsCount = 0;
                } else {
                    errorsCount++;
                }

                if (errorsCount >= MAX_ERRORS) break;
            }

            nextNumber += batchSize * 10;
            firstBatch = false;
        }

        return paths;
    }

    function arrangePhotoPaths(discoveredItems) {
        const pinned = new Map();
        const regular = [];

        discoveredItems.forEach(item => {
            if (FAVORITE_RANKS.includes(item.favoriteRank) && !pinned.has(item.favoriteRank)) {
                pinned.set(item.favoriteRank, item);
            } else {
                regular.push(item);
            }
        });

        const shuffledRegular = shuffle(regular);
        const topThree = FAVORITE_RANKS.map(rank => (
            pinned.get(rank) || shuffledRegular.shift()
        )).filter(Boolean);

        return [...topThree, ...shuffledRegular];
    }

    function setGalleryEmptyContactOpen(open) {
        if (!galleryEmptyContactToggle || !galleryEmptyContactOptions) return;
        galleryEmptyContactToggle.setAttribute('aria-expanded', String(open));
        galleryEmptyContactOptions.setAttribute('aria-hidden', String(!open));
        galleryEmptyContactOptions.classList.toggle('active', open);
    }

    function hideGalleryEmpty() {
        if (galleryEmpty) galleryEmpty.hidden = true;
        setGalleryEmptyContactOpen(false);
    }

    function showGalleryEmpty() {
        if (!galleryEmpty) return false;
        galleryEmpty.hidden = false;
        if (loader) loader.classList.add('hidden');
        return true;
    }

    galleryEmptyContactToggle?.addEventListener('click', () => {
        const isOpen = galleryEmptyContactToggle.getAttribute('aria-expanded') === 'true';
        setGalleryEmptyContactOpen(!isOpen);
    });

    async function loadGallery(folderPath) {
        const sessionId = ++loadSession;
        nextRevealAt = 0;
        lightboxOrder = [];
        currentLightboxIndex = -1;
        loadedLightboxSources.clear();
        lightboxAltBySource.clear();
        updateLightboxControls();
        gallery.innerHTML = '';
        gallery.style.height = '';
        hideGalleryEmpty();
        if (loader) loader.classList.remove('hidden');

        const discoveredItems = await discoverPhotoPaths(folderPath, sessionId);
        if (sessionId !== loadSession) return;

        if (discoveredItems.length === 0) {
            showGalleryEmpty();
            return;
        }

        const orderedItems = arrangePhotoPaths(discoveredItems);
        lightboxOrder = orderedItems.map(item => item.lightboxSrc);
        updateLightboxControls();

        // Верхний ряд загружается параллельно, но вставляется строго слева направо.
        const firstRowItems = orderedItems.slice(0, getColumnCount());
        const remainingItems = orderedItems.slice(firstRowItems.length);
        const firstRowImages = await Promise.all(firstRowItems.map(async item => {
            try {
                const image = await loadImage(item.previewSrc);
                return { item, image };
            } catch (error) {
                return null;
            }
        }));

        if (sessionId !== loadSession) return;

        firstRowImages.filter(Boolean).forEach(({ item, image }) => {
            createPhotoBlock(item, image, folderPath);
        });

        for (const item of remainingItems) {
            if (sessionId !== loadSession) return;

            try {
                const image = await loadImage(item.previewSrc);
                if (sessionId !== loadSession) return;
                createPhotoBlock(item, image, folderPath);
            } catch (error) {
                // Один повреждённый файл не должен останавливать всю галерею
            }
        }

        if (!gallery.querySelector('.photo')) {
            showGalleryEmpty();
        }
    }

    // === ПЕРЕКЛЮЧЕНИЕ ЖАНРА ===
    function switchGenre(folderPath) {
        if (folderPath === currentFolder) return;
        
        currentFolder = folderPath;

        // Обновление активной кнопки
        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.folder === folderPath);
        });

        loadGallery(folderPath);
    }

    // Обработчики кликов по кнопкам
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchGenre(btn.dataset.folder);
        });
    });

    // Запуск дефолтной галереи (Репортаж)
    loadGallery(currentFolder);

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            layoutPhotos();
        }, 120);
    });

    // === ЛАЙТБОКС ===
    function updateLightboxControls() {
        const availablePhotos = lightboxOrder.reduce((count, src) => (
            count + (loadedLightboxSources.has(src) ? 1 : 0)
        ), 0);
        const disabled = availablePhotos < 2;

        [lightboxPrev, lightboxNext].forEach((button) => {
            if (!button) return;
            button.disabled = disabled;
            button.classList.toggle('is-disabled', disabled);
        });
    }

    function addLightboxHistoryEntry() {
        if (lightboxHistoryActive) return;

        try {
            history.pushState(
                { ...(history.state || {}), lightboxOpen: true },
                '',
                window.location.href
            );
            lightboxHistoryActive = true;
        } catch (error) {
            // Лайтбокс продолжит работать и там, где History API недоступен.
        }
    }

    function setLightboxPhoto(index) {
        if (!lightboxOrder.length) return;

        const normalizedIndex = (index + lightboxOrder.length) % lightboxOrder.length;
        const src = lightboxOrder[normalizedIndex];
        if (!loadedLightboxSources.has(src)) return;

        const wasOpen = lightbox.classList.contains('active');
        currentLightboxIndex = normalizedIndex;
        lightboxImg.src = src;
        lightboxImg.alt = lightboxAltBySource.get(src) || 'Фотография из портфолио';
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (!wasOpen) addLightboxHistoryEntry();
    }

    function preloadLightboxPhoto(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.decoding = 'async';
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`Не удалось подготовить ${src}`));
            image.src = src;

            if (image.complete && image.naturalWidth) resolve();
        });
    }

    async function animateLightboxPhoto(index, entryVector) {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const canAnimate = (
            typeof lightboxImg.animate === 'function' &&
            typeof lightboxBuffer?.animate === 'function'
        );

        if (reducedMotion || !canAnimate || currentLightboxIndex < 0) {
            setLightboxPhoto(index);
            return;
        }

        lightboxTransitioning = true;
        const animationToken = ++lightboxAnimationToken;
        const distance = window.innerWidth <= 600 ? 18 : 14;
        const outX = -entryVector.x * distance;
        const outY = -entryVector.y * distance;
        const inX = entryVector.x * distance;
        const inY = entryVector.y * distance;
        const centered = 'translate(-50%, -50%)';
        let outgoing;
        let incoming;

        try {
            const normalizedIndex = (index + lightboxOrder.length) % lightboxOrder.length;
            const src = lightboxOrder[normalizedIndex];
            const alt = lightboxAltBySource.get(src) || 'Фотография из портфолио';

            await preloadLightboxPhoto(src);
            if (animationToken !== lightboxAnimationToken || !lightbox.classList.contains('active')) return;

            lightboxBuffer.src = src;
            lightboxBuffer.alt = alt;
            if (typeof lightboxBuffer.decode === 'function') {
                await lightboxBuffer.decode().catch(() => {});
            }
            if (animationToken !== lightboxAnimationToken || !lightbox.classList.contains('active')) return;

            outgoing = lightboxImg.animate([
                { transform: `${centered} translate3d(0, 0, 0)`, opacity: 1 },
                { transform: `${centered} translate3d(${outX}px, ${outY}px, 0)`, opacity: 0 }
            ], {
                duration: 220,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'both'
            });
            incoming = lightboxBuffer.animate([
                { transform: `${centered} translate3d(${inX}px, ${inY}px, 0)`, opacity: 0 },
                { transform: `${centered} translate3d(0, 0, 0)`, opacity: 1 }
            ], {
                duration: 220,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'both'
            });

            await Promise.all([outgoing.finished, incoming.finished]);
            if (animationToken !== lightboxAnimationToken || !lightbox.classList.contains('active')) return;

            currentLightboxIndex = normalizedIndex;
            lightboxImg.src = src;
            lightboxImg.alt = alt;
            if (typeof lightboxImg.decode === 'function') {
                await lightboxImg.decode().catch(() => {});
            }

            outgoing.cancel();
            incoming.cancel();
            lightboxBuffer.removeAttribute('src');
            lightboxBuffer.alt = '';
        } catch (error) {
            if (animationToken === lightboxAnimationToken && lightbox.classList.contains('active')) {
                setLightboxPhoto(index);
            }
        } finally {
            outgoing?.cancel();
            incoming?.cancel();
            lightboxBuffer?.getAnimations().forEach(animation => animation.cancel());
            if (lightboxBuffer) {
                lightboxBuffer.removeAttribute('src');
                lightboxBuffer.alt = '';
            }
            lightboxTransitioning = false;
        }
    }

    function showLightboxPhoto(index) {
        if (lightboxTransitioning) return;
        setLightboxPhoto(index);
    }

    function navigateLightbox(direction, entryVector = { x: direction, y: 0 }) {
        if (lightboxTransitioning || currentLightboxIndex < 0 || lightboxOrder.length < 2) return;

        for (let offset = 1; offset <= lightboxOrder.length; offset++) {
            const candidateIndex = (
                currentLightboxIndex + direction * offset + lightboxOrder.length
            ) % lightboxOrder.length;
            const candidateSrc = lightboxOrder[candidateIndex];

            if (loadedLightboxSources.has(candidateSrc)) {
                animateLightboxPhoto(candidateIndex, entryVector);
                return;
            }
        }
    }

    function closeLightbox({ fromHistory = false } = {}) {
        lightboxAnimationToken++;
        lightboxImg.getAnimations?.().forEach(animation => animation.cancel());
        lightboxBuffer?.getAnimations?.().forEach(animation => animation.cancel());
        lightboxTransitioning = false;
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        currentLightboxIndex = -1;

        if (lightboxHistoryActive) {
            lightboxHistoryActive = false;
            if (!fromHistory) {
                ignoreNextLightboxPopstate = true;
                history.back();
            }
        }

        setTimeout(() => {
            if (!lightbox.classList.contains('active')) {
                lightboxImg.src = '';
                lightboxImg.alt = '';
                if (lightboxBuffer) {
                    lightboxBuffer.removeAttribute('src');
                    lightboxBuffer.alt = '';
                }
            }
        }, 300);
    }

    gallery.addEventListener('click', (e) => {
        const img = e.target.closest('.photo img');
        if (!img) return;
        const src = img.dataset.src;
        const index = lightboxOrder.indexOf(src);
        if (index !== -1) showLightboxPhoto(index);
    });

    lightboxPrev?.addEventListener('click', () => navigateLightbox(-1));
    lightboxNext?.addEventListener('click', () => navigateLightbox(1));

    lightbox.addEventListener('click', (e) => {
        if (e.target.closest('.lightbox-img, .lightbox-nav')) return;
        closeLightbox();
    });

    window.addEventListener('popstate', () => {
        if (ignoreNextLightboxPopstate) {
            ignoreNextLightboxPopstate = false;
            return;
        }

        if (lightbox.classList.contains('active')) {
            closeLightbox({ fromHistory: true });
        }
    });

    lightbox.addEventListener('touchstart', (e) => {
        if (!lightbox.classList.contains('active') || e.touches.length !== 1) {
            swipeStartX = null;
            swipeStartY = null;
            return;
        }

        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
        if (swipeStartX === null || swipeStartY === null || !e.changedTouches.length) return;

        const deltaX = e.changedTouches[0].clientX - swipeStartX;
        const deltaY = e.changedTouches[0].clientY - swipeStartY;
        const swipeThreshold = Math.max(50, window.innerWidth * 0.08);

        swipeStartX = null;
        swipeStartY = null;

        const horizontalSwipe = Math.abs(deltaX) >= swipeThreshold && Math.abs(deltaX) >= Math.abs(deltaY);
        const verticalSwipe = Math.abs(deltaY) >= swipeThreshold && Math.abs(deltaY) > Math.abs(deltaX);

        if (horizontalSwipe) {
            const direction = deltaX < 0 ? 1 : -1;
            navigateLightbox(direction, { x: direction, y: 0 });
        } else if (verticalSwipe) {
            const direction = deltaY < 0 ? 1 : -1;
            navigateLightbox(direction, { x: 0, y: direction });
        }
    }, { passive: true });

    lightbox.addEventListener('touchcancel', () => {
        swipeStartX = null;
        swipeStartY = null;
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;

        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateLightbox(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateLightbox(1);
        }
    });

    // === ЦЕНЫ ===
    const priceModal = document.getElementById('priceModal');
    const openPriceBtn = document.getElementById('openPrice');
    const priceContactToggle = document.getElementById('priceContactToggle');
    const priceContactOptions = document.getElementById('priceContactOptions');

    function setPriceContactOpen(open) {
        if (!priceContactToggle || !priceContactOptions) return;
        priceContactToggle.setAttribute('aria-expanded', String(open));
        priceContactOptions.setAttribute('aria-hidden', String(!open));
        priceContactOptions.classList.toggle('active', open);
    }

    function closePriceModal() {
        if (!priceModal) return;
        priceModal.classList.remove('active');
        document.body.style.overflow = '';
        setPriceContactOpen(false);
    }

    if (openPriceBtn && priceModal) {
        openPriceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            setPriceContactOpen(false);
            priceModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    priceContactToggle?.addEventListener('click', () => {
        const isOpen = priceContactToggle.getAttribute('aria-expanded') === 'true';
        setPriceContactOpen(!isOpen);
    });
    if (priceModal) {
        priceModal.addEventListener('click', (e) => {
            if (e.target === priceModal) closePriceModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && priceModal && priceModal.classList.contains('active')) {
            closePriceModal();
        }
    });

    // === ОБО МНЕ ===
    const aboutModal = document.getElementById('aboutModal');
    const openAboutButtons = document.querySelectorAll('[data-open-about]');

    const closeAboutModal = () => {
        if (!aboutModal) return;
        aboutModal.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (aboutModal) {
        openAboutButtons.forEach((button) => {
            button.addEventListener('click', () => {
                aboutModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        });
    }
    aboutModal?.addEventListener('click', (e) => {
        if (e.target === aboutModal) closeAboutModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && aboutModal?.classList.contains('active')) {
            closeAboutModal();
        }
    });

    // Плавающая кнопка «Наверх»
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) {
        const infoSection = document.querySelector('.info-section');
        let backToTopFrame = 0;
        let boundaryScrollY = Infinity;
        let returnRevealScrollY = Infinity;
        let boundaryLocked = false;
        let returningFromBoundary = false;
        let lastScrollY = window.scrollY;

        const getShowAfter = () => Math.min(640, window.innerHeight * 0.7);

        // Граница вычисляется в координатах документа и не зависит от уже
        // сдвинутой кнопки. Благодаря этому конечная точка не колеблется.
        const measureBackToTopBoundary = () => {
            backToTopBtn.style.setProperty('--back-to-top-lift', '0px');

            if (!infoSection) {
                boundaryScrollY = Infinity;
                returnRevealScrollY = Infinity;
                return;
            }

            const buttonStyles = getComputedStyle(backToTopBtn);
            const baseBottom = parseFloat(buttonStyles.bottom) || 0;
            const buttonHeight = backToTopBtn.offsetHeight;
            const normalButtonTop = window.innerHeight - baseBottom - buttonHeight;
            const infoDocumentTop = window.scrollY + infoSection.getBoundingClientRect().top;
            // В конечной точке кнопка фиксируется внутри верхнего правого угла
            // инфоблока на всех разрешениях.
            const targetDocumentTop = infoDocumentTop + 8;

            boundaryScrollY = Math.max(0, targetDocumentTop - normalButtonTop);
            // При движении вверх кнопка возвращается после прохождения примерно
            // четверти обратного пути: уже не у самого низа, но заметно раньше.
            returnRevealScrollY = Math.max(getShowAfter(), boundaryScrollY * 0.72);
        };

        const updateBackToTop = () => {
            const scrollY = window.scrollY;
            const scrollingUp = scrollY < lastScrollY - 1;

            if (!boundaryLocked && scrollY >= boundaryScrollY) {
                boundaryLocked = true;
            }
            if (boundaryLocked && scrollingUp) {
                returningFromBoundary = true;
            }
            if (returningFromBoundary && scrollY <= returnRevealScrollY) {
                boundaryLocked = false;
                returningFromBoundary = false;
            }

            const isAtInfoBoundary = boundaryLocked && !returningFromBoundary;
            const boundaryLift = isAtInfoBoundary
                ? Math.max(0, scrollY - boundaryScrollY)
                : 0;
            const waitingForReturnReveal = boundaryLocked && returningFromBoundary;
            const shouldShow = scrollY > getShowAfter() && !waitingForReturnReveal;

            backToTopBtn.style.setProperty('--back-to-top-lift', `${Math.round(boundaryLift)}px`);
            backToTopBtn.classList.toggle('is-visible', shouldShow);
            backToTopBtn.classList.toggle('is-at-info-boundary', isAtInfoBoundary);
            backToTopBtn.setAttribute('aria-hidden', String(!shouldShow));
            backToTopBtn.tabIndex = shouldShow ? 0 : -1;
            lastScrollY = scrollY;
            backToTopFrame = 0;
        };

        const queueBackToTopUpdate = () => {
            if (backToTopFrame) return;
            backToTopFrame = window.requestAnimationFrame(updateBackToTop);
        };

        backToTopBtn.addEventListener('click', () => {
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            backToTopBtn.blur();
            window.scrollTo({
                top: 0,
                behavior: reducedMotion ? 'auto' : 'smooth'
            });
        });

        window.addEventListener('scroll', queueBackToTopUpdate, { passive: true });
        window.addEventListener('resize', () => {
            boundaryLocked = false;
            returningFromBoundary = false;
            measureBackToTopBoundary();
            queueBackToTopUpdate();
        });
        window.addEventListener('load', () => {
            measureBackToTopBoundary();
            queueBackToTopUpdate();
        });
        if ('ResizeObserver' in window && gallery) {
            const backToTopBoundaryObserver = new ResizeObserver(() => {
                measureBackToTopBoundary();
                queueBackToTopUpdate();
            });
            backToTopBoundaryObserver.observe(gallery);
        }
        measureBackToTopBoundary();
        updateBackToTop();
    }
});
