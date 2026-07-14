document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('gallery');
    const loader = document.getElementById('gallery-loader');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.lightbox-close');
    const navButtons = document.querySelectorAll('.nav-btn');

    // === GENRES NAVIGATION ===
    const genreConfig = {
        'img/gallery/reportage/': {
            altPool: [
                "Репортажная съемка мероприятия в Москве",
                "Съемка живых событий",
                "Живые эмоции и спонтанные моменты",
                "Атмосфера мероприятия в деталях",
                "Спонтанные моменты в кадре",
                "Репортажный кадр с мероприятия",
                "Ключевые моменты события в кадре",
                "Динамика и энергия мероприятия"
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
    const MAX_ERRORS = 5;
    const DISCOVERY_BATCH_SIZE = 10;
    const FIRST_PHOTO_CANDIDATES = [10, 20, 30];
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

    // Раскладка по условным рядам: слева направо, затем следующий ряд
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

            const columnIndex = index % columnCount;
            const photoHeight = columnWidth * image.naturalHeight / image.naturalWidth;
            const x = paddingLeft + columnIndex * (columnWidth + gap);
            const y = columnHeights[columnIndex];

            photo.style.width = `${columnWidth}px`;
            photo.style.height = `${photoHeight}px`;
            photo.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            photo.dataset.column = columnIndex;
            columnHeights[columnIndex] += photoHeight + gap;
        });

        const contentHeight = Math.max(...columnHeights) - gap + paddingBottom;
        gallery.style.height = `${Math.max(0, contentHeight)}px`;
    }

    function createPhotoBlock(src, image, folderPath) {
        const div = document.createElement('div');
        div.className = 'photo';
        image.alt = getAltText(folderPath);
        image.decoding = 'async';
        image.dataset.src = src;
        div.appendChild(image);
        gallery.appendChild(div);

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
            image.onload = () => resolve(image);
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

    // Поиск файлов 010.webp, 020.webp и далее небольшими параллельными пачками
    async function discoverPhotoPaths(folderPath, sessionId) {
        const paths = [];
        let nextNumber = 10;
        let errorsCount = 0;

        while (errorsCount < MAX_ERRORS && sessionId === loadSession) {
            const candidates = Array.from({ length: DISCOVERY_BATCH_SIZE }, (_, index) => {
                const number = nextNumber + index * 10;
                const fileName = String(number).padStart(3, '0');
                return `${folderPath}${fileName}.webp`;
            });

            const results = await Promise.all(candidates.map(async src => ({
                src,
                exists: await fileExists(src)
            })));

            for (const result of results) {
                if (sessionId !== loadSession) return [];

                if (result.exists) {
                    paths.push(result.src);
                    errorsCount = 0;
                } else {
                    errorsCount++;
                }

                if (errorsCount >= MAX_ERRORS) break;
            }

            nextNumber += DISCOVERY_BATCH_SIZE * 10;
        }

        return paths;
    }

    // Первый кадр выбирается из начала папки и загружается одновременно с поиском остальных
    async function loadFirstPhoto(folderPath, sessionId) {
        const candidates = shuffle(FIRST_PHOTO_CANDIDATES).map(number => {
            const fileName = String(number).padStart(3, '0');
            return `${folderPath}${fileName}.webp`;
        });

        for (const src of candidates) {
            if (sessionId !== loadSession) return null;

            try {
                const image = await loadImage(src);
                if (sessionId !== loadSession) return null;
                return { src, image };
            } catch (error) {
                // Пробуем следующий файл из стартовой тройки
            }
        }

        return null;
    }

    async function loadGallery(folderPath) {
        const sessionId = ++loadSession;
        nextRevealAt = 0;
        gallery.innerHTML = '';
        gallery.style.height = '';
        if (loader) loader.classList.remove('hidden');

        const discoveryPromise = discoverPhotoPaths(folderPath, sessionId);
        let firstPhoto = await loadFirstPhoto(folderPath, sessionId);

        if (sessionId !== loadSession) return;

        if (firstPhoto) {
            createPhotoBlock(firstPhoto.src, firstPhoto.image, folderPath);
        }

        let photoPaths = await discoveryPromise;
        if (sessionId !== loadSession) return;

        if (!firstPhoto && photoPaths.length > 0) {
            photoPaths = shuffle(photoPaths);
            const firstPath = photoPaths.shift();

            try {
                const image = await loadImage(firstPath);
                if (sessionId !== loadSession) return;
                firstPhoto = { src: firstPath, image };
                createPhotoBlock(firstPath, image, folderPath);
            } catch (error) {
                // Остальные файлы всё равно продолжают загружаться
            }
        }

        const remainingPaths = shuffle(photoPaths.filter(src => src !== firstPhoto?.src));

        for (const src of remainingPaths) {
            if (sessionId !== loadSession) return;

            try {
                const image = await loadImage(src);
                if (sessionId !== loadSession) return;
                createPhotoBlock(src, image, folderPath);
            } catch (error) {
                // Один повреждённый файл не должен останавливать всю галерею
            }
        }

        // Если папка пока пустая, оставляем индикатор на экране.
        // Он скроется автоматически после появления первой фотографии.
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
        resizeTimer = setTimeout(layoutPhotos, 120);
    });

    // === ЛАЙТБОКС ===
    gallery.addEventListener('click', (e) => {
        const img = e.target.closest('.photo img');
        if (!img) return;
        lightboxImg.src = img.src;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    const closeLightbox = () => {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => { lightboxImg.src = ''; }, 300);
    };

    closeBtn?.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
    });

    // === ЦЕНЫ ===
    const priceModal = document.getElementById('priceModal');
    const openPriceBtn = document.getElementById('openPrice');

    if (openPriceBtn && priceModal) {
        openPriceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            priceModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    if (priceModal) {
        priceModal.addEventListener('click', (e) => {
            if (e.target === priceModal) {
                priceModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && priceModal && priceModal.classList.contains('active')) {
            priceModal.classList.remove('active');
            document.body.style.overflow = '';
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

        // Кнопка Наверх
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
