const swytchcode = require('../swytchcode/client');

async function attachMedia(postData) {
    console.log("--- Starting Media Module ---");
    const mediaUrl = await swytchcode.executeMediaGeneration(postData.image_prompt);
    postData.image_url = mediaUrl;
    return postData;
}

module.exports = { attachMedia };
