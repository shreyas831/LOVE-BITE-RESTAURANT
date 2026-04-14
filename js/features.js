// Enhanced Features: Favorites, Quantity Selector, Price Filter, Ratings
(function() {
    // =====================================================
    // FAVORITES FEATURE
    // =====================================================
    
    const FAVORITES_KEY = 'lovebite_favorites';
    let favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');

    function toggleFavorite(itemId) {
        const id = parseInt(itemId);
        const index = favorites.indexOf(id);
        if (index > -1) {
            favorites.splice(index, 1);
        } else {
            favorites.push(id);
        }
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        updateFavoriteButtons();
        showNotification(index > -1 ? 'Removed from favorites' : 'Added to favorites', 'success');
    }

    function updateFavoriteButtons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const itemId = btn.dataset.itemId;
            if (favorites.includes(parseInt(itemId))) {
                btn.classList.add('liked');
                btn.innerHTML = '❤️';
            } else {
                btn.classList.remove('liked');
                btn.innerHTML = '🤍';
            }
        });
    }

    // =====================================================
    // QUANTITY SELECTOR
    // =====================================================

    function addQuantitySelector(container, itemId) {
        const selector = document.createElement('div');
        selector.className = 'quantity-selector';
        selector.innerHTML = `
            <button class="qty-btn" data-action="decrease" data-item="${itemId}">−</button>
            <input type="number" class="qty-input" value="1" min="1" max="100" data-item="${itemId}">
            <button class="qty-btn" data-action="increase" data-item="${itemId}">+</button>
        `;
        container.appendChild(selector);

        // Event listeners
        selector.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', handleQuantityChange);
        });

        selector.querySelector('.qty-input').addEventListener('change', handleQuantityInput);
    }

    function handleQuantityChange(e) {
        const action = e.target.dataset.action;
        const itemId = e.target.dataset.item;
        const input = e.target.closest('.quantity-selector').querySelector('.qty-input');
        let value = parseInt(input.value);

        if (action === 'increase') value++;
        if (action === 'decrease' && value > 1) value--;

        input.value = value;
    }

    function handleQuantityInput(e) {
        let value = parseInt(e.target.value);
        if (value < 1) e.target.value = 1;
        if (value > 100) e.target.value = 100;
    }

    // =====================================================
    // PRICE FILTER
    // =====================================================

    function initPriceFilter() {
        const priceRange = document.getElementById('priceRange');
        const priceValue = document.getElementById('priceValue');
        const maxPrice = document.getElementById('maxPrice');
        const menuItems = document.getElementById('menuItems');

        if (!priceRange) return;

        priceRange.addEventListener('input', (e) => {
            const maxVal = e.target.value;
            priceValue.textContent = `₹0 - ₹${maxVal}`;
            maxPrice.textContent = `₹${maxVal}`;

            // Filter items
            document.querySelectorAll('.menu-card').forEach(card => {
                const price = parseInt(card.dataset.price || 0);
                if (price <= maxVal) {
                    card.style.display = '';
                    card.style.animation = 'slideInUp 0.4s ease-out';
                } else {
                    card.style.display = 'none';
                }
            });

            // Show "no results" message if needed
            const visibleCards = Array.from(document.querySelectorAll('.menu-card')).filter(
                card => card.style.display !== 'none'
            );
            
            if (visibleCards.length === 0 && menuItems) {
                if (!document.querySelector('.no-results')) {
                    const noResults = document.createElement('div');
                    noResults.className = 'no-results text-center text-gray-500 py-12';
                    noResults.innerHTML = '<p>No items found in this price range</p>';
                    menuItems.appendChild(noResults);
                }
            } else {
                const noResults = document.querySelector('.no-results');
                if (noResults) noResults.remove();
            }
        });
    }

    // =====================================================
    // STAR RATING DISPLAY
    // =====================================================

    function addStarRating(container, rating = 0) {
        const ratingDiv = document.createElement('div');
        ratingDiv.className = 'rating flex items-center gap-2';

        const score = document.createElement('span');
        score.className = 'text-sm text-gray-600 font-medium';
        score.textContent = rating > 0 ? rating.toFixed(1) : '';
        ratingDiv.appendChild(score);

        container.appendChild(ratingDiv);
    }

    // =====================================================
    // NOTIFICATION
    // =====================================================

    function showNotification(message, type = 'info') {
        const notificationPanel = document.getElementById('notificationPanel');
        if (!notificationPanel) return;

        const notification = document.createElement('div');
        notification.className = `bg-${type === 'success' ? 'green' : 'blue'}-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 animate-pulse`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'} text-xl"></i>
            <p>${message}</p>
        `;

        notificationPanel.appendChild(notification);
        notificationPanel.classList.remove('hidden');

        setTimeout(() => {
            notification.remove();
            if (notificationPanel.children.length === 0) {
                notificationPanel.classList.add('hidden');
            }
        }, 3000);
    }

    // =====================================================
    // ENHANCE MENU CARDS
    // =====================================================

    function enhanceMenuCards() {
        const cards = document.querySelectorAll('.menu-card');
        cards.forEach(card => {
            // Add data attribute for price filtering
            const priceText = card.querySelector('p:last-of-type')?.textContent;
            const price = priceText ? parseInt(priceText.replace(/[^0-9]/g, '')) : 0;
            card.dataset.price = price;

            // Add favorite button
            const header = card.querySelector('div:first-child');
            if (header) {
                const itemId = card.dataset.itemId || (Date.now() + Math.floor(Math.random() * 1000));
                card.dataset.itemId = itemId;
                
                const favBtn = document.createElement('button');
                favBtn.className = 'favorite-btn';
                favBtn.dataset.itemId = itemId;
                favBtn.innerHTML = '🤍';
                favBtn.style.zIndex = '10';
                favBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite(itemId);
                });
                header.style.position = 'relative';
                header.appendChild(favBtn);
            }

            // Add star rating
            const priceSection = card.querySelector('div:last-of-type');
            if (priceSection) {
                addStarRating(priceSection);
            }

            // Add quantity selector to add to cart button
            const addBtn = card.querySelector('button[id*="add"]');
            if (addBtn) {
                const parent = addBtn.parentElement;
                const itemId = card.dataset.itemId || (Date.now() + Math.floor(Math.random() * 1000));
                addQuantitySelector(parent, itemId);
            }
        });

        updateFavoriteButtons();
    }

    // =====================================================
    // POPULAR BADGE
    // =====================================================

    function addPopularBadges() {
        document.querySelectorAll('[data-popular="true"]').forEach(card => {
            if (!card.querySelector('.popular-badge')) {
                const badge = document.createElement('div');
                badge.className = 'popular-badge';
                badge.textContent = '⭐ Popular';
                card.style.position = 'relative';
                card.insertBefore(badge, card.firstChild);
            }
        });
    }

    // =====================================================
    // SCROLL ANIMATIONS
    // =====================================================

    function initScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        document.querySelectorAll('.menu-card').forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'all 0.6s ease-out';
            observer.observe(card);
        });
    }

    // =====================================================
    // INITIALIZATION
    // =====================================================

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            enhanceMenuCards();
            addPopularBadges();
            initPriceFilter();
            initScrollAnimations();
        }, 500);
    });

    // Re-initialize when menu items are updated
    window.addEventListener('menuUpdated', () => {
        enhanceMenuCards();
        addPopularBadges();
        initScrollAnimations();
    });

})();
