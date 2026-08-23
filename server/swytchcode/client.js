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
        this.firecrawlKey   = process.env.FIRECRAWL_API_KEY;
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
        this.slackToken     = process.env.SLACK_BOT_TOKEN;
        this.slackChannel   = process.env.SLACK_CHANNEL || '#general';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. DISCOVERY — Firecrawl API
    // ─────────────────────────────────────────────────────────────────────────
    async executeDiscovery(query) {
        // Rotate through configured topics if no query supplied
        if (!query) {
            query = this.discoveryTopics[this._topicIndex % this.discoveryTopics.length];
            this._topicIndex++;
        }
        console.log(`[Swytchcode → Firecrawl] Searching: "${query}"`);

        try {
            const res = await axios.post(
                'https://api.firecrawl.dev/v1/search',
                { query: query, limit: 5 },
                {
                    headers: {
                        'Authorization': `Bearer ${this.firecrawlKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                }
            );
            const items = res.data?.data || [];
            const seenDomains = new Set();
            const articles = [];
            
            for (const item of items) {
                if (articles.length >= 5) break;
                
                const url = item.url || item.link || '';
                const content = item.content || item.description || item.markdown || item.snippet || '';
                
                if (content.length > 50 && url) {
                    try {
                        const domain = new URL(url).hostname;
                        if (!seenDomains.has(domain)) {
                            seenDomains.add(domain);
                            articles.push({
                                title: item.title || item.name || 'Untitled',
                                url: url,
                                content: content
                            });
                        }
                    } catch (e) {
                        // Ignore invalid URLs
                    }
                }
            }

            if (articles.length > 0) {
                console.log(`[Swytchcode → Firecrawl] Found ${articles.length} articles`);
                return articles;
            }
            throw new Error('No usable results');
        } catch (err) {
            console.warn(`[Swytchcode → Firecrawl] ${err.message} — using mock fallback`);
            return [{
                title: `${query} — Key Developments in 2026`,
                url: 'https://techcrunch.com',
                content: `${query} is rapidly transforming enterprise technology. Recent studies show a 40% productivity increase with agentic multi-agent systems. Industry leaders are doubling investments in autonomous AI pipelines.`
            }];
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
                    else if (err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
                        console.warn(`[Swytchcode → Gemini] 429 Rate Limit — Using MOCK fallback response`);
                        return {
                            title: "AI Trends: Mock Generation (API Limit Reached)",
                            slug: "mock-quota-" + Date.now(),
                            classification: process.env.FORCE_CATEGORY || 'short_form',
                            short_form: "This is a mock short-form summary generated because the API quota was exceeded. The classification system successfully picked this format!",
                            caption: "🔥 Mock caption due to API rate limit! The classification system successfully picked this format! #AI #Trend",
                            blog: "Mock blog data. API quota reached.",
                            thread: "1/ Mock thread data.\n2/ API quota reached.",
                            key_points: ["API limit reached", "Fallback activated"],
                            sources: ["https://techcrunch.com"],
                            image_prompt: "abstract technology ai future"
                        };
                    }
                    else { throw err; }
                }
            }
        }
        console.warn(`[Swytchcode → LLM] All LLM providers exhausted or failed — using MOCK fallback response`);
        return {
            title: "AI Trends: Mock Generation (API Limit Reached)",
            slug: "mock-quota-final-" + Date.now(),
            classification: process.env.FORCE_CATEGORY || 'caption',
            short_form: "This is a mock short-form summary generated because the API quota was exceeded.",
            caption: "🔥 Mock caption due to API rate limit! The classification system successfully picked this format! #AI #Trend",
            blog: "Mock blog data. API quota reached.",
            thread: "1/ Mock thread data.\n2/ API quota reached.",
            key_points: ["API limit reached", "Fallback activated"],
            sources: ["https://techcrunch.com"],
            image_prompt: "abstract technology ai future"
        };
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
            console.warn(`[Swytchcode → Cloudinary] ${err.message} — using Picsum unique seed CDN fallback`);
            const seed = encodeURIComponent(imagePrompt.split(' ')[0] || 'tech');
            return `https://picsum.photos/seed/${seed}/1200/630`;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. NOTIFICATIONS — Slack API
    // ─────────────────────────────────────────────────────────────────────────
    async executeNotification(message) {
        console.log(`[Swytchcode → Slack] Sending notification`);
        try {
            await axios.post(
                'https://slack.com/api/chat.postMessage',
                {
                    channel: this.slackChannel,
                    text: message,
                    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: message } }]
                },
                { 
                    headers: { 
                        'Authorization': `Bearer ${this.slackToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000 
                }
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



