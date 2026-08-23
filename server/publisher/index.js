const { insertPost } = require('../db/schema');
const swytchcode = require('../swytchcode/client');

async function publishAndNotify(postData) {
    console.log("--- Starting Publisher Module ---");
    
    // 1. Insert into MongoDB
    postData.publish_status = 'Published';
    const postId = await insertPost(postData);
    console.log(`Inserted post into MongoDB with ID: ${postId}`);
    
    // 2. Notify via Slack/Telegram
    const message = `🚀 New Article Live: *${postData.title}*\nRead it here: /post/${postData.slug}`;
    const notificationResult = await swytchcode.executeNotification(message);
    
    return { postId, notificationResult };
}

module.exports = { publishAndNotify };

