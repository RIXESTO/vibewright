const swytchcode = require('../swytchcode/client');
const slugify = require('slugify');

async function generateGroundedPost(contextChunks) {
    console.log("--- Starting Generation Module ---");
    
    // Convert RAG context to a string block
    const contextText = contextChunks.map(c => `Source URL: ${c.url}\nTitle: ${c.title}\nContent: ${c.content}`).join('\n\n');
    
    const prompt = `
    You are an expert tech journalist and social media manager. Use ONLY the following retrieved context to write an original piece of content in 4 distinct formats:
    1. A short-form summary (1 punchy paragraph)
    2. A social media caption (with emojis and hashtags)
    3. A full blog post (multi-paragraph markdown)
    4. A Twitter/X style thread (numbered 1/, 2/, etc.)
    
    Do not hallucinate facts outside this context.
    
    Retrieved Context:
    ${contextText}
    
    Output your response as valid JSON matching this exact structure:
    {
        "title": "A catchy title for the article",
        "slug": "url-friendly-slug",
        "short_form": "The punchy 1-paragraph summary",
        "caption": "The social media caption with emojis",
        "blog": "The full markdown body of the blog post",
        "thread": "The Twitter/X style thread (numbered list)",
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
