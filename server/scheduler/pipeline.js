const { runDiscoveryAndExtract } = require('../discovery');
const { processRAG } = require('../rag');
const { generateGroundedPost } = require('../generator');
const { attachMedia } = require('../media');
const { publishAndNotify } = require('../publisher');
const { logPipelineRun } = require('../db/schema');

async function executeFullPipeline(runType = 'manual') {
    try {
        console.log(`\n========== PIPELINE START (${runType}) ==========`);
        
        // Step 1: Discovery
        const articles = await runDiscoveryAndExtract();
        if (articles.length === 0) {
            logPipelineRun(runType, 'success', 'No new trends discovered.');
            return { status: 'skipped', message: 'No new trends.' };
        }
        
        // Step 2: RAG
        const contextChunks = await processRAG(articles);
        
        // Step 3: Generator
        let postData = await generateGroundedPost(contextChunks);
        
        // Step 4: Media
        postData = await attachMedia(postData);
        
        // Step 5: Publish & Notify
        await publishAndNotify(postData);
        
        console.log("========== PIPELINE COMPLETE ==========\n");
        logPipelineRun(runType, 'success', `Successfully published: ${postData.title}`);
        
        return { status: 'success', post: postData };
    } catch (error) {
        console.error("\n========== PIPELINE FAILED ==========");
        console.error(error);
        logPipelineRun(runType, 'error', error.message);
        throw error;
    }
}

module.exports = { executeFullPipeline };
