const swytchcode = require('../swytchcode/client');
const slugify = require('slugify');

async function generateGroundedPost(contextChunks) {
    console.log("--- Starting Generation Module ---");
    
    // Convert RAG context to a string block
    const contextText = contextChunks.map(c => `Source URL: ${c.url}\nTitle: ${c.title}\nContent: ${c.content}`).join('\n\n');
    
    const prompt = `
    You are an expert AI content classifier and tech journalist.
    First, carefully analyze the retrieved context and determine which ONE of the following 4 formats is the BEST fit for presenting this information:
    - "short_form": if it's a quick summary or simple announcement.
    - "caption": if it's highly visual, promotional, or a simple social media hook.
    - "blog": if it's detailed, multi-faceted, or long-form analysis.
    - "thread": if it's a sequence of events, listicle, or step-by-step breakdown.
    
    After deciding the best classification, output that category name exactly in the "classification" field.
    Then, write the content exclusively in the corresponding field for that classification, leaving the other 3 content fields as empty strings ("").
    
    Do not hallucinate facts outside this context.
    
    Retrieved Context:
    ${contextText}
    
    Output your response as valid JSON matching this exact structure:
    {
        "title": "A catchy title for the article",
        "slug": "url-friendly-slug",
        "classification": "the exact string of the chosen category (short_form, caption, blog, or thread)",
        "short_form": "The punchy 1-paragraph summary (or empty string if not classified as short_form)",
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
