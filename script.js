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
    let currentNumber = 10;
    let errorsCount = 0;
    const MAX_ERRORS = 5;

    // Получение случайного описания из пула текущего жанра
    function getAltText() {
        const config = genreConfig[currentFolder];
        if (!config || !config.altPool.length) return "Фотография из портфолио";
        return config.altPool[Math.floor(Math.random() * config.altPool.length)];
    }

    function createPhotoBlock(src) {
        const div = document.createElement('div');
        div.className = 'photo';
        div.innerHTML = `<img src="${src}" alt="${getAltText()}" loading="lazy">`;
        gallery.appendChild(div);
    }

    function loadNextPhoto() {
        const fileName = String(currentNumber).padStart(3, '0');
        const fullPath = `${currentFolder}${fileName}.webp`;
        const img = new Image();

        img.onload = () => {
            errorsCount = 0;
            createPhotoBlock(fullPath);
            currentNumber += 10;
            loadNextPhoto();
        };

        img.onerror = () => {
            errorsCount++;
            if (errorsCount >= MAX_ERRORS) {
                runAnimation();
            } else {
                currentNumber += 10;
                loadNextPhoto();
            }
        };

        img.src = fullPath;
    }

function runAnimation() {
    const photos = Array.from(gallery.querySelectorAll('.photo'));
    if (photos.length === 0) return;

    // Перемешивание удалено. Фотографии остаются в порядке загрузки (010, 020, 030...)

    gallery.innerHTML = '';
    photos.forEach(p => gallery.appendChild(p));

    // Скрытие лоадер
    if (loader) loader.classList.add('hidden');

    // Загрузка фото после скрытия лоадера
    setTimeout(() => {
        const finalPhotos = Array.from(gallery.querySelectorAll('.photo'));
        const photoData = finalPhotos.map(el => {
            const rect = el.getBoundingClientRect();
            return { el, pos: rect.top + rect.left };
        });
        photoData.sort((a, b) => a.pos - b.pos);

        photoData.forEach((item, index) => {
            setTimeout(() => item.el.classList.add('visible'), index * 50);
        });
    }, 400);
}

    // === ПЕРЕКЛЮЧЕНИЕ ЖАНРА ===
    function switchGenre(folderPath) {
        if (folderPath === currentFolder) return;
        
        currentFolder = folderPath;
        currentNumber = 10;
        errorsCount = 0;
        
        gallery.innerHTML = '';
        if (loader) loader.classList.remove('hidden');

        // Обновление активной кнопки
        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.folder === folderPath);
        });

        loadNextPhoto();
    }

    // Обработчики кликов по кнопкам
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchGenre(btn.dataset.folder);
        });
    });

    // Запуск дефолтной галереи (Репортаж)
    loadNextPhoto();

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
    const closePriceBtn = document.querySelector('.price-modal-close');

    if (openPriceBtn && priceModal) {
        openPriceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            priceModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    if (closePriceBtn && priceModal) {
        closePriceBtn.addEventListener('click', () => {
            priceModal.classList.remove('active');
            document.body.style.overflow = '';
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
        // Кнопка Наверх
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});