# Swytchcode RAG Pipeline

A fully automated, Swytchcode-routed RAG trend-to-content pipeline that discovers trends, grounds them in evidence, generates structured posts, and publishes to a website on a fixed schedule.

## Mental Model
`User/Event → AI Agent → Swytchcode → External APIs → Result/Action`
All external APIs are wrapped by the Swytchcode Client execution layer.

## Architecture
- **`/server/discovery`**: Fetches trends via Jina/Firecrawl.
- **`/server/rag`**: Chunks and stores context in Weaviate.
- **`/server/generator`**: LLM module generating structured JSON.
- **`/server/media`**: Generates header images via Cloudinary.
- **`/server/publisher`**: Inserts posts to SQLite and notifies via Slack.
- **`/server/swytchcode`**: The execution layer that mocks or connects external APIs.
- **`/server/scheduler`**: `node-cron` daemon for daily automation.
- **`/web`**: React UI (Feed, Post View, Admin Logs).

## Setup Instructions

1. **Install Dependencies**
   ```bash
   cd server && npm install
   cd ../web && npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env` inside the `server/` folder and fill in your API keys (Gemini API key is required for the LLM).

3. **Run the Application**
   Open two terminals:
   - Terminal 1 (Backend API & Admin endpoints): `cd server && node server.js`
   - Terminal 2 (React Frontend): `cd web && npm run dev`

4. **Start the Scheduler**
   - Terminal 3 (Cron Daemon): `cd server && node scheduler/index.js`

## How to Change the Posting Schedule
Open `server/scheduler/index.js`.
You will find this line:
```javascript
cron.schedule('0 8 * * *', async () => { ... });
```
Change the cron string to adjust the time. For example, `30 14 * * *` means 2:30 PM every day.

## Manual Testing (Seed Script)
You can test the entire pipeline end-to-end without waiting for the cron schedule:
```bash
cd server && node scheduler/seed.js
```
