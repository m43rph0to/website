document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('gallery');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.lightbox-close');

    // === НАСТРОЙКИ АВТО-ЗАГРУЗКИ ===
    const config = {
        folder: 'img/gallery/',
        extension: '.webp',
        start: 10,
        step: 10,
        maxAttempts: 200,
        maxErrorsInRow: 5
    };

    let currentNumber = config.start;
    let errorsCount = 0;

    function loadNextPhoto() {
        if (currentNumber > config.maxAttempts) {
            runAnimation();
            return;
        }

        const fileName = String(currentNumber).padStart(3, '0');
        const fullPath = `${config.folder}${fileName}${config.extension}`;
        const img = new Image();

        img.onload = () => {
            errorsCount = 0;
            createPhotoBlock(fullPath, `Фото ${fileName}`);
            currentNumber += config.step;
            loadNextPhoto();
        };

        img.onerror = () => {
            errorsCount++;
            currentNumber += config.step;
            if (errorsCount >= config.maxErrorsInRow) {
                console.log('Галерея загружена.');
                runAnimation();
            } else {
                loadNextPhoto();
            }
        };

        img.src = fullPath;
    }

    function createPhotoBlock(src, alt) {
        const div = document.createElement('div');
        div.className = 'photo';
        div.innerHTML = `<img src="${src}" alt="${alt}" loading="lazy">`;
        gallery.appendChild(div);
    }

function runAnimation() {
    // 1. Получаем все элементы фото
    const photoElements = Array.from(gallery.querySelectorAll('.photo'));

    // 2. Перемешиваем массив элементов (алгоритм Фишера-Йетса)
    // Это гарантирует случайный порядок расположения в сетке
    for (let i = photoElements.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [photoElements[i], photoElements[j]] = [photoElements[j], photoElements[i]];
    }

    // 3. Очищаем галерею и вставляем элементы в новом порядке
    // Это заставляет браузер перестроить Masonry-сетку хаотично
    gallery.innerHTML = '';
    photoElements.forEach(photo => gallery.appendChild(photo));

    // 4. Запускаем анимацию с небольшой задержкой
    // Задержка нужна, чтобы браузер успел пересчитать координаты новой сетки
    setTimeout(() => {
        const finalElements = Array.from(gallery.querySelectorAll('.photo'));
        
        // Собираем текущие координаты каждого элемента
        const photoData = finalElements.map(el => {
            const rect = el.getBoundingClientRect();
            return { el, top: rect.top, left: rect.left };
        });

        // Сортируем по диагонали (эффект веера): сумма координат Y + X
        // Чем меньше сумма, тем ближе элемент к левому верхнему углу
        photoData.sort((a, b) => (a.top + a.left) - (b.top + b.left));

        // Поочередно показываем фото
        photoData.forEach((item, index) => {
            setTimeout(() => {
                item.el.classList.add('visible');
            }, index * 60); // 60ms - скорость появления
        });
    }, 150);
}

    loadNextPhoto();

    // --- Лайтбокс ---
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
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
    });

    // --- Модальное окно прайс-листа ---
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
});