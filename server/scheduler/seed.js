require('dotenv').config({ path: '../.env' });
const { executeFullPipeline } = require('./pipeline');

async function seed() {
    console.log("Starting manual seed pipeline...");
    try {
        await executeFullPipeline('seed-script');
        console.log("Seed complete. Check the database or web UI.");
        process.exit(0);
    } catch (error) {
        console.error("Seed failed:", error);
        process.exit(1);
    }
}

seed();
