const cron = require('node-cron');
const { executeFullPipeline } = require('./pipeline');
require('dotenv').config({ path: '../.env' });

console.log("Scheduler starting...");
console.log("Cron configured to run daily at 08:00 AM.");

// Schedule tasks to be run on the server.
// '0 8 * * *' = Run at 08:00 AM every day
cron.schedule('0 8 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Executing scheduled cron job...`);
    try {
        await executeFullPipeline('cron');
    } catch (error) {
        console.error("Cron job failed:", error);
    }
});

// Keep process alive
process.stdin.resume();
