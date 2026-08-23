const swytchcode = require('../swytchcode/client');
const slugify = require('slugify');

async function generateGroundedPost(contextChunks) {
    console.log("--- Starting Generation Module ---");
    
    // Convert RAG context to a string block
    const contextText = contextChunks.map(c => `Source URL: ${c.url}\nTitle: ${c.title}\nContent: ${c.content}`).join('\n\n');
    
    const prompt = `
    You are an expert tech journalist. Use ONLY the following retrieved context to write an original article.
    Do not hallucinate facts outside this context.
    
    Retrieved Context:
    ${contextText}
    
    Output your response as valid JSON matching this exact structure:
    {
        "title": "A catchy title for the article",
        "slug": "url-friendly-slug",
        "body": "The full markdown body of the article (3-4 paragraphs)",
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
