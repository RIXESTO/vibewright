const swytchcode = require('../swytchcode/client');

async function processRAG(articles) {
    console.log("--- Starting RAG Module ---");
    // 1. Chunk and store in Weaviate
    await swytchcode.executeRAGStore(articles);
    
    // 2. Retrieve top-k context for generation
    // We assume the top trend is what we want to write about
    const query = articles[0]?.title || "latest tech trend";
    const contextChunks = await swytchcode.executeRAGRetrieve(query, 3);
    
    return contextChunks;
}

module.exports = { processRAG };
