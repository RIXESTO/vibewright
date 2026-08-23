document.addEventListener('DOMContentLoaded', fetchPosts);

async function fetchPosts() {
    try {
        const response = await fetch('/api/posts');
        const posts = await response.json();
        renderPosts(posts);
    } catch (error) {
        console.error("Error fetching posts:", error);
    }
}

function renderPosts(posts) {
    const container = document.getElementById('posts-container');
    const countEl = document.getElementById('post-count');
    
    container.innerHTML = '';
    countEl.textContent = posts.length;

    if (posts.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No posts generated yet. Run the automation pipeline!</p>';
        return;
    }

    posts.forEach(post => {
        const date = new Date(post.timestamp).toLocaleString();
        
        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
            <div class="post-header">
                <span class="post-time">${date}</span>
                <span class="post-tag">🤖 Auto-Generated</span>
            </div>
            <div class="post-content">
                ${post.content.replace(/\n/g, '<br>')}
            </div>
            <div class="post-source">
                Source Trend: <a href="${post.trend.url}" target="_blank">${post.trend.title}</a>
            </div>
        `;
        container.appendChild(card);
    });
}

async function triggerAutomation() {
    const btnText = document.querySelector('.btn-text');
    const loader = document.getElementById('loader');
    const btn = document.getElementById('trigger-btn');
    
    // UI Loading state
    btn.disabled = true;
    btnText.style.display = 'none';
    loader.style.display = 'block';

    try {
        const response = await fetch('/api/trigger-automation', {
            method: 'POST'
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            await fetchPosts(); // Refresh the feed
        } else {
            alert('Error running automation: ' + data.message);
        }
    } catch (error) {
        console.error("Automation error:", error);
        alert('Failed to connect to the server.');
    } finally {
        // Reset UI state
        btn.disabled = false;
        btnText.style.display = 'block';
        loader.style.display = 'none';
    }
}
