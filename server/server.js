const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { executeFullPipeline } = require('./scheduler/pipeline');
const { connectDB, getPosts, getPostBySlug, getLogs } = require('./db/schema');

const app = express();
app.use(cors());
app.use(express.json());

// Get all posts for Homepage feed
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await getPosts();
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single post by slug
app.get('/api/posts/:slug', async (req, res) => {
    try {
        const post = await getPostBySlug(req.params.slug);
        if (!post) return res.status(404).json({ error: "Post not found" });
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get logs for Admin page
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await getLogs();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Manual run trigger from Admin page
app.post('/api/trigger-automation', async (req, res) => {
    try {
        const result = await executeFullPipeline('manual-api');
        res.json(result);
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

const PORT = process.env.PORT || 5001;

async function start() {
    await connectDB(); // Ensure MongoDB is connected before accepting requests
    app.listen(PORT, () => {
        console.log(`Trend Automator API running on port ${PORT}...`);
        console.log(`Database: MongoDB`);
    });
}

start();

