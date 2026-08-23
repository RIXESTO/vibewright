const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ─── Connection ──────────────────────────────────────────────────────────────
let isConnected = false;

async function connectDB() {
    if (isConnected) return;
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trend_automator';
    await mongoose.connect(uri);
    isConnected = true;
    console.log(`[MongoDB] Connected → ${uri}`);
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
const PostSchema = new mongoose.Schema({
    slug:           { type: String, unique: true, required: true },
    title:          { type: String, required: true },
    caption:        { type: String },
    blog:           { type: String },
    thread:         { type: String },
    classification: { type: String },
    key_points:     { type: [String], default: [] },
    sources:        { type: [String], default: [] },
    tags:           { type: [String], default: [] },
    image_prompt:   { type: String },
    image_url:      { type: String, default: '' },
    publish_status: { type: String, default: 'Draft' },
    created_at:     { type: Date, default: Date.now }
});

const PipelineLogSchema = new mongoose.Schema({
    run_type:   { type: String }, // 'cron', 'manual', 'seed-script'
    status:     { type: String }, // 'success', 'error'
    message:    { type: String },
    created_at: { type: Date, default: Date.now }
});

const Post        = mongoose.models.Post        || mongoose.model('Post', PostSchema);
const PipelineLog = mongoose.models.PipelineLog || mongoose.model('PipelineLog', PipelineLogSchema);

// ─── CRUD Functions ───────────────────────────────────────────────────────────

/**
 * Insert or update a post (upsert by slug).
 * Returns the MongoDB _id of the saved document.
 */
async function insertPost(post) {
    await connectDB();
    const doc = await Post.findOneAndUpdate(
        { slug: post.slug },
        {
            slug:           post.slug,
            title:          post.title,
            caption:        post.caption,
            blog:           post.blog,
            thread:         post.thread,
            classification: post.classification || 'unknown',
            key_points:     post.key_points  || [],
            sources:        post.sources     || [],
            tags:           post.tags        || [],
            image_prompt:   post.image_prompt,
            image_url:      post.image_url   || '',
            publish_status: post.publish_status || 'Draft',
            created_at:     new Date()
        },
        { upsert: true, returnDocument: 'after' }
    );
    return doc._id.toString();
}

/**
 * Fetch all posts, newest first.
 */
async function getPosts() {
    await connectDB();
    return Post.find().sort({ created_at: -1 }).lean();
}

/**
 * Fetch a single post by slug.
 */
async function getPostBySlug(slug) {
    await connectDB();
    return Post.findOne({ slug }).lean();
}

/**
 * Write a pipeline run log entry (non-blocking).
 */
async function logPipelineRun(runType, status, message) {
    await connectDB();
    PipelineLog.create({ run_type: runType, status, message }).catch(err =>
        console.error('[MongoDB] Failed to write log:', err.message)
    );
}

/**
 * Fetch the 50 most recent pipeline logs.
 */
async function getLogs() {
    await connectDB();
    return PipelineLog.find().sort({ created_at: -1 }).limit(50).lean();
}

module.exports = { connectDB, insertPost, getPosts, getPostBySlug, logPipelineRun, getLogs };

