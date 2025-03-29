document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const productTitle = urlParams.get('product');
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};

    if (!productTitle) {
        window.location.href = 'index.html';
        return;
    }

    fetch('data/products.json')
        .then(response => response.json())
        .then(data => {
            const product = data.find(p => p.title === productTitle);
            if (!product) {
                window.location.href = 'index.html';
                return;
            }

            // Set product image and title
            document.getElementById('product-img').src = `assets/games/${productTitle.replace(/ /g, '_')}.jpg`;
            document.getElementById('product-title').textContent = product.title;
            document.getElementById('product-name-delivery').textContent = product.title;

            // Populate requirements list
            const requirementsList = document.getElementById('game-requirements');
            if (product.input_fields && product.input_fields.length > 0) {
                product.input_fields.forEach(field => {
                    const fieldName = field.name.trim().replace(/[\[\]]/g, '').trim();
                    const labelText = field.front_name || fieldName.split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    const li = document.createElement('li');
                    li.textContent = labelText;
                    requirementsList.appendChild(li);
                });
            }

            // Add input fields
            if (product.input_fields && product.input_fields.length > 0) {
                const inputFieldsContainer = document.getElementById('input-fields');
                const inputsHTML = product.input_fields.map(field => {
                    const fieldName = field.name.trim().replace(/[\[\]]/g, '').trim();
                    let labelText = field.front_name;
                    
                    if (!labelText) {
                        labelText = fieldName.split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                    }
                    return `
                        <div class="input-group">
                            <label for="${fieldName}">${labelText}</label>
                            <input type="${field.type}" id="${fieldName}" name="${fieldName}" required>
                        </div>
                    `;
                }).join('');
                inputFieldsContainer.innerHTML += inputsHTML;
            }

            // Display items
            const itemsContainer = document.getElementById('items-list');
            product.items.forEach(item => {
                const itemCard = document.createElement('div');
                itemCard.className = 'item-card';
                itemCard.innerHTML = `
                    <h3 class="item-name">${item.item_name}</h3>
                    <p class="item-price">${item.item_price}</p>
                `;

                itemCard.addEventListener('click', () => {
                    updateQuantity(item, 1);
                });

                itemsContainer.appendChild(itemCard);
            });

            // Show cart panel
            document.getElementById('cart-panel').style.display = 'block';
        });

    function updateQuantity(item, change) {
        const existingItem = cart.find(i => i.item_name === item.item_name);
        if (existingItem) {
            existingItem.quantity += change;
            if (existingItem.quantity <= 0) {
                cart = cart.filter(i => i.item_name !== item.item_name);
            }
        } else if (change > 0) {
            cart.push({
                ...item,
                quantity: 1
            });
            
            // Show visual feedback when item is added
            const itemCards = document.querySelectorAll('.item-card');
            itemCards.forEach(card => {
                if (card.querySelector('.item-name').textContent === item.item_name) {
                    const originalBackground = card.style.backgroundColor;
                    card.style.backgroundColor = '#e7f7e7';
                    card.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.6)';
                    
                    setTimeout(() => {
                        card.style.backgroundColor = originalBackground;
                        card.style.boxShadow = '';
                    }, 500);
                }
            });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCart();
        
        // Update cart count in header immediately
        document.getElementById('cart-count').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    function validateInputs() {
        const inputs = document.querySelectorAll('#input-fields input[required]');
        const isValid = Array.from(inputs).every(input => {
            const value = input.value.trim();
            if (value !== '') {
                const fieldName = input.name.includes('[') ? 
                    input.name.match(/\[(.*?)\]$/)[1] : 
                    input.name.trim();
                userInfo[fieldName] = value;
                localStorage.setItem('userInfo', JSON.stringify(userInfo));
                return true;
            }
            return false;
        });
        return isValid;
    }

    function updateBuyNowButton() {
        const buyNowBtn = document.getElementById('buy-now-btn');
        buyNowBtn.textContent = 'Add to Cart';
        const hasItems = cart.length > 0;
        const inputsValid = validateInputs();
        buyNowBtn.disabled = !(hasItems && inputsValid);
    }

    function handleBuyNow() {
        const inputs = document.querySelectorAll('#input-fields input[required]');
        inputs.forEach(input => {
            const fieldName = input.name.includes('[') ? 
                input.name.match(/\[(.*?)\]$/)[1] : 
                input.name.trim();
            userInfo[fieldName] = input.value.trim();
        });
        localStorage.setItem('userInfo', JSON.stringify(userInfo));

        const orderData = {
            userInfo: userInfo,
            cart: cart
        };
        
        // Show visual feedback
        const buyNowBtn = document.getElementById('buy-now-btn');
        const originalText = buyNowBtn.textContent;
        buyNowBtn.textContent = 'Added to Cart ✓';
        buyNowBtn.style.backgroundColor = '#45a049';
        
        setTimeout(() => {
            buyNowBtn.textContent = originalText;
            buyNowBtn.style.backgroundColor = '';
            // Redirect to payment page
            window.location.href = 'payment.html';
        }, 1500);
    }

    function updateCart() {
        const cartItems = document.getElementById('cart-items');
        cartItems.innerHTML = '';

        let total = 0;
        document.getElementById('cart-count').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
        cart.forEach(item => {
            const price = parseFloat(item.item_price.replace('৳', '').replace(',', ''));
            const itemTotal = price * item.quantity;
            total += itemTotal;

            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.item_name}</div>
                    <div class="cart-item-price">৳ ${itemTotal.toFixed(2)}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="cart-quantity-btn minus">-</button>
                    <span class="cart-quantity-display">${item.quantity}</span>
                    <button class="cart-quantity-btn plus">+</button>
                </div>
            `;

            const minusBtn = cartItem.querySelector('.minus');
            const plusBtn = cartItem.querySelector('.plus');

            minusBtn.addEventListener('click', () => updateQuantity(item, -1));
            plusBtn.addEventListener('click', () => updateQuantity(item, 1));

            cartItems.appendChild(cartItem);
        });

        document.getElementById('cart-total').textContent = `Total: ৳ ${total.toFixed(2)}`;
        updateBuyNowButton();
    }

    // Add event listeners for input validation
    const inputFields = document.getElementById('input-fields');
    inputFields.addEventListener('input', updateBuyNowButton);

    // Add event listener for Buy Now button
    const buyNowBtn = document.getElementById('buy-now-btn');
    buyNowBtn.addEventListener('click', handleBuyNow);
});