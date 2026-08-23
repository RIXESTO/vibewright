const path   = require('path');
const axios  = require('axios');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { GoogleGenAI } = require('@google/genai');

/**
 * SwytchcodeClient — Execution Layer
 * ALL external API calls route through this module.
 * Mental Model: Agent → SwytchcodeClient → External APIs → Result
 */
class SwytchcodeClient {
    constructor() {
        // Discovery
        this.jinaKey        = process.env.JINA_API_KEY;
        this.discoveryTopics = (process.env.DISCOVERY_QUERY_TOPICS || 'trending tech news').split(',').map(t => t.trim());
        this._topicIndex    = 0;

        // Weaviate RAG
        this.weaviateUrl    = (process.env.WEAVIATE_URL || '').replace(/\/$/, '');
        this.weaviateKey    = process.env.WEAVIATE_API_KEY;
        this.weaviateClass  = process.env.WEAVIATE_CLASS_NAME || 'TrendArticleEvidence';
        this.topK           = parseInt(process.env.RAG_TOP_K_CHUNKS) || 5;
        this._memStore      = []; // in-memory fallback

        // LLM
        this.openaiKey      = process.env.OPENAI_API_KEY;
        this.openaiModel    = process.env.OPENAI_MODEL || 'gpt-4o';
        this.geminiKey      = process.env.GEMINI_API_KEY;
        if (this.geminiKey) this.ai = new GoogleGenAI({ apiKey: this.geminiKey });

        // Cloudinary
        this.cloudName      = process.env.CLOUDINARY_CLOUD_NAME;
        this.cloudKey       = process.env.CLOUDINARY_API_KEY;
        this.cloudSecret    = process.env.CLOUDINARY_API_SECRET;
        this.cloudFolder    = process.env.CLOUDINARY_FOLDER || 'trend_content_pipeline';

        // Notifications
        this.slackWebhook   = process.env.SLACK_WEBHOOK_URL;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. DISCOVERY — Jina Search API
    // ─────────────────────────────────────────────────────────────────────────
    async executeDiscovery(query) {
        // Rotate through configured topics if no query supplied
        if (!query) {
            query = this.discoveryTopics[this._topicIndex % this.discoveryTopics.length];
            this._topicIndex++;
        }
        console.log(`[Swytchcode → Jina] Searching: "${query}"`);

        try {
            const res = await axios.get(
                `https://s.jina.ai/${encodeURIComponent(query)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.jinaKey}`,
                        'Accept': 'application/json',
                        'X-Return-Format': 'json'
                    },
                    timeout: 15000
                }
            );
            const items = res.data?.data || res.data?.results || [];
            const articles = items
                .slice(0, 5)
                .map(item => ({
                    title:   item.title   || item.name        || 'Untitled',
                    url:     item.url     || item.link        || '',
                    content: item.content || item.description || item.snippet || ''
                }))
                .filter(a => a.content.length > 50);

            if (articles.length > 0) {
                console.log(`[Swytchcode → Jina] Found ${articles.length} articles`);
                return articles;
            }
            throw new Error('No usable results');
        } catch (err) {
            console.warn(`[Swytchcode → Jina Search] ${err.message} — trying Jina Reader fallback`);
            try {
                // Fallback: read TechCrunch front page
                const res = await axios.get('https://r.jina.ai/https://techcrunch.com', {
                    headers: { 'Authorization': `Bearer ${this.jinaKey}`, 'Accept': 'application/json' },
                    timeout: 15000
                });
                const content = res.data?.data?.content || '';
                return [{ title: `Trending: ${query}`, url: 'https://techcrunch.com', content: String(content).slice(0, 3000) }];
            } catch (fallbackErr) {
                console.warn(`[Swytchcode → Jina] Reader also failed — using mock`);
                return [{
                    title: `${query} — Key Developments in 2026`,
                    url: 'https://techcrunch.com',
                    content: `${query} is rapidly transforming enterprise technology. Recent studies show a 40% productivity increase with agentic multi-agent systems. Industry leaders are doubling investments in autonomous AI pipelines.`
                }];
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. RAG STORE — Weaviate REST API
    // ─────────────────────────────────────────────────────────────────────────
    async executeRAGStore(documents) {
        console.log(`[Swytchcode → Weaviate] Storing ${documents.length} chunks`);
        // Always keep an in-memory copy for same-process retrieval
        this._memStore.push(...documents);

        try {
            for (const doc of documents) {
                await axios.post(
                    `${this.weaviateUrl}/v1/objects`,
                    {
                        class: this.weaviateClass,
                        properties: {
                            title:     doc.title   || '',
                            url:       doc.url     || '',
                            content:   doc.content || '',
                            timestamp: new Date().toISOString()
                        }
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.weaviateKey}`,
                            'Content-Type':  'application/json'
                        },
                        timeout: 10000
                    }
                );
            }
            console.log(`[Swytchcode → Weaviate] Stored ${documents.length} objects ✓`);
            return { status: 'success', storedCount: documents.length };
        } catch (err) {
            console.warn(`[Swytchcode → Weaviate Store] ${err.message} — using in-memory fallback`);
            return { status: 'fallback', storedCount: documents.length };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. RAG RETRIEVE — Weaviate GraphQL nearText
    // ─────────────────────────────────────────────────────────────────────────
    async executeRAGRetrieve(query, topK = this.topK) {
        console.log(`[Swytchcode → Weaviate] Retrieving context for: "${query}"`);

        try {
            const gql = {
                query: `{
                    Get {
                        ${this.weaviateClass}(
                            nearText: { concepts: ["${query.replace(/"/g, '\\"')}"] }
                            limit: ${topK}
                        ) { title url content }
                    }
                }`
            };
            const res = await axios.post(`${this.weaviateUrl}/v1/graphql`, gql, {
                headers: {
                    'Authorization': `Bearer ${this.weaviateKey}`,
                    'Content-Type':  'application/json'
                },
                timeout: 10000
            });
            const items = res.data?.data?.Get?.[this.weaviateClass] || [];
            if (items.length > 0) {
                console.log(`[Swytchcode → Weaviate] Retrieved ${items.length} chunks ✓`);
                return items;
            }
            throw new Error('No results from Weaviate');
        } catch (err) {
            console.warn(`[Swytchcode → Weaviate Retrieve] ${err.message} — using in-memory fallback`);
            if (this._memStore.length > 0) return this._memStore.slice(0, topK);
            return [{
                title:   query,
                url:     'https://techcrunch.com',
                content: `${query}: Recent breakthroughs show transformative potential. Industry adoption is accelerating with measurable productivity gains across enterprise deployments.`
            }];
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. LLM GENERATION — OpenAI (primary) → Gemini (fallback)
    // ─────────────────────────────────────────────────────────────────────────
    async executeLLM(prompt) {
        console.log(`[Swytchcode → LLM] Generating post...`);

        // ── OpenAI primary ────────────────────────────────────────────────────
        if (this.openaiKey) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    console.log(`[Swytchcode → OpenAI ${this.openaiModel}] Attempt ${attempt}/2`);
                    const res = await axios.post(
                        'https://api.openai.com/v1/chat/completions',
                        {
                            model:           this.openaiModel,
                            messages:        [{ role: 'user', content: prompt }],
                            response_format: { type: 'json_object' },
                            temperature:     0.7
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${this.openaiKey}`,
                                'Content-Type':  'application/json'
                            },
                            timeout: 60000
                        }
                    );
                    const text = res.data.choices[0].message.content;
                    console.log(`[Swytchcode → OpenAI] Success ✓`);
                    return JSON.parse(text);
                } catch (err) {
                    const status = err.response?.status;
                    if ((status === 429 || status === 500) && attempt < 2) {
                        console.warn(`[Swytchcode → OpenAI] ${status} — retrying in 3s`);
                        await new Promise(r => setTimeout(r, 3000));
                    } else {
                        console.warn(`[Swytchcode → OpenAI] Failed (${err.message}) — switching to Gemini`);
                        break;
                    }
                }
            }
        }

        // ── Gemini fallback ───────────────────────────────────────────────────
        if (!this.ai) throw new Error('No LLM providers available.');
        const models = ['gemini-3.6-flash', 'gemini-2.0-flash'];
        for (const model of models) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`[Swytchcode → Gemini ${model}] Attempt ${attempt}/3`);
                    const res = await this.ai.models.generateContent({
                        model,
                        contents: prompt,
                        config: { responseMimeType: 'application/json' }
                    });
                    console.log(`[Swytchcode → Gemini] Success ✓`);
                    return JSON.parse(res.text);
                } catch (err) {
                    const is503 = err.status === 503 || err.message?.includes('503');
                    if (is503 && attempt < 3) {
                        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
                    } else if (is503) { break; }
                    else { throw err; }
                }
            }
        }
        throw new Error('All LLM providers exhausted — try again later.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. MEDIA — Cloudinary signed upload
    // ─────────────────────────────────────────────────────────────────────────
    async executeMediaGeneration(imagePrompt) {
        console.log(`[Swytchcode → Cloudinary] Uploading media...`);
        try {
            // Source: Unsplash (keyword from prompt)
            const keyword = imagePrompt.split(' ').slice(0, 3).join(',');
            const sourceUrl = `https://source.unsplash.com/1200x630/?technology,${encodeURIComponent(keyword)}`;

            // Cloudinary signed upload
            const timestamp  = Math.floor(Date.now() / 1000).toString();
            const paramsStr  = `folder=${this.cloudFolder}&timestamp=${timestamp}`;
            const signature  = crypto.createHash('sha1')
                                     .update(paramsStr + this.cloudSecret)
                                     .digest('hex');

            const body = new URLSearchParams({
                file:      sourceUrl,
                api_key:   this.cloudKey,
                timestamp,
                signature,
                folder:    this.cloudFolder
            });

            const res = await axios.post(
                `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
                body.toString(),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 }
            );
            const url = res.data.secure_url;
            console.log(`[Swytchcode → Cloudinary] Uploaded ✓ ${url}`);
            return url;
        } catch (err) {
            console.warn(`[Swytchcode → Cloudinary] ${err.message} — using Unsplash CDN fallback`);
            const kw = encodeURIComponent(imagePrompt.split(' ')[0] || 'technology');
            return `https://source.unsplash.com/1200x630/?technology,${kw}`;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. NOTIFICATIONS — Slack Incoming Webhook
    // ─────────────────────────────────────────────────────────────────────────
    async executeNotification(message) {
        console.log(`[Swytchcode → Slack] Sending notification`);
        try {
            await axios.post(
                this.slackWebhook,
                {
                    text: message,
                    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: message } }]
                },
                { timeout: 5000 }
            );
            console.log(`[Swytchcode → Slack] Delivered ✓`);
            return { status: 'delivered', platform: 'Slack', timestamp: new Date().toISOString() };
        } catch (err) {
            // Non-critical — log and continue
            console.warn(`[Swytchcode → Slack] ${err.message} (notification skipped)`);
            return { status: 'skipped', platform: 'Slack', error: err.message };
        }
    }
}

module.exports = new SwytchcodeClient();



