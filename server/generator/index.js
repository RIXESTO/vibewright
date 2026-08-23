const swytchcode = require('../swytchcode/client');
const slugify = require('slugify');

async function generateGroundedPost(contextChunks) {
    console.log("--- Starting Generation Module ---");
    
    // Convert RAG context to a string block
    const contextText = contextChunks.map(c => `Source URL: ${c.url}\nTitle: ${c.title}\nContent: ${c.content}`).join('\n\n');
    
    // Deterministically pick a category to ensure the feed has a diverse mix of all 3 formats
    const categories = ['caption', 'blog', 'thread'];
    const forcedCategory = process.env.FORCE_CATEGORY || categories[Math.floor(Math.random() * categories.length)];

    const prompt = `
    You are an expert AI content classifier and tech journalist.
    Your task is to take the retrieved context and distill it strictly into a "${forcedCategory}" format.
    - "caption": distill the context into a punchy, emoji-filled social media hook.
    - "blog": write a detailed, multi-faceted analysis.
    - "thread": write a sequence of events or step-by-step breakdown.
    
    You MUST output "${forcedCategory}" in the "classification" field.
    Then, write the content exclusively in the corresponding field for "${forcedCategory}", leaving the other 2 content fields as empty strings ("").
    
    Do not hallucinate facts outside this context.
    
    Retrieved Context:
    ${contextText}
    
    Output your response as valid JSON matching this exact structure:
    {
        "title": "A catchy title for the article",
        "slug": "url-friendly-slug",
        "classification": "the exact string of the chosen category (caption, blog, or thread)",
        "caption": "The social media caption with emojis (or empty string)",
        "blog": "The full markdown body of the blog post (or empty string)",
        "thread": "The Twitter/X style thread numbered list (or empty string)",
        "key_points": ["point 1", "point 2"],
        "sources": ["url1", "url2"],
        "tags": ["tag1", "tag2"],
        "image_prompt": "A highly detailed prompt for an AI image generator to create a header image"
    }
    `;

    try {
        const jsonResponse = await swytchcode.executeLLM(prompt);
        
        // Ensure slug is valid if LLM messed it up
        if (!jsonResponse.slug) {
            jsonResponse.slug = slugify(jsonResponse.title, { lower: true, strict: true });
        }
        
        return jsonResponse;
    } catch (error) {
        console.error("LLM Generation Failed:", error);
        throw error;
    }
}

module.exports = { generateGroundedPost };
