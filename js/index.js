document.addEventListener('DOMContentLoaded', function() {
    // Initialize starfield canvas
    const canvas = document.getElementById('stars-canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Create stars
    const stars = [];
    const starCount = 100;
    
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 1.5,
            vx: Math.floor(Math.random() * 50) - 25,
            vy: Math.floor(Math.random() * 50) - 25
        });
    }
    
    // Animation function
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        
        stars.forEach(star => {
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Move star
            star.x += star.vx / 100;
            star.y += star.vy / 100;
            
            // Reset star if out of bounds
            if (star.x < 0 || star.x > canvas.width) star.x = Math.random() * canvas.width;
            if (star.y < 0 || star.y > canvas.height) star.y = Math.random() * canvas.height;
        });
        
        requestAnimationFrame(animate);
    }
    
    // Start animation
    animate();
    
    // Load products
    fetch('data/products.json')
        .then(response => response.json())
        .then(data => {
            const gamesContainer = document.getElementById('games-container');

            data.forEach(game => {
                const gameCard = document.createElement('div');
                gameCard.className = 'game-card';
                // Add onclick handler to make the card clickable
                gameCard.onclick = () => {
                    window.location.href = `products.html?product=${encodeURIComponent(game.title)}`;
                };
                
                // Map product titles to actual image filenames
                const imageMap = {
                    'Mobile legends: Bang Bang Indonesia': 'Mobile_legends_Indonesia',
                    'Xbox Gift Card (US)': 'Xbox_Gift_Card_US',
                    // Default to cleaned title if not in map
                };
                
                let imageName = imageMap[game.title] ||
                    game.title
                        .replace(/ /g, '_')
                        .replace(/:/g, '')
                        .replace(/\(/g, '')
                        .replace(/\)/g, '')
                        .replace(/,/g, '');
                
                // Fallback to default image if not found
                gameCard.innerHTML = `
                    <div class="game-image">
                        <img src="assets/games/${imageName}.jpg" alt="${game.title}" onerror="this.src='assets/games/default-game.jpg'">
                    </div>
                    <div class="game-info">
                        <h3 class="game-title">${game.title}</h3>
                        <a href="products.html?product=${encodeURIComponent(game.title)}" class="buy-btn">Buy Now</a>
                    </div>
                `;
                
                gamesContainer.appendChild(gameCard);
            });
        })
        .catch(error => {
            console.error('Error loading products:', error);
        });

    // Handle window resize
    window.addEventListener('resize', function() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
});