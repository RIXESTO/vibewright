from flask import Flask, jsonify, request, send_from_directory
import json
import os
from datetime import datetime
from backend.trend_fetcher import fetch_trending_topic
from backend.generator import generate_social_post

app = Flask(__name__, static_folder='static', static_url_path='')

DB_FILE = 'database.json'

def load_db():
    if not os.path.exists(DB_FILE):
        return []
    with open(DB_FILE, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/posts', methods=['GET'])
def get_posts():
    posts = load_db()
    # Return newest first
    return jsonify(sorted(posts, key=lambda x: x['timestamp'], reverse=True))

@app.route('/api/trigger-automation', methods=['POST'])
def trigger_automation():
    try:
        print("1. Fetching trend...")
        trend = fetch_trending_topic()
        
        print(f"2. Generating post for: {trend['title']}...")
        post_content = generate_social_post(trend)
        
        print("3. Saving to database...")
        new_post = {
            "id": str(datetime.now().timestamp()),
            "trend": trend,
            "content": post_content,
            "timestamp": datetime.now().isoformat()
        }
        
        posts = load_db()
        posts.append(new_post)
        save_db(posts)
        
        return jsonify({"status": "success", "post": new_post})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # Initialize empty db if not exists
    if not os.path.exists(DB_FILE):
        save_db([])
    print("Starting Trend Automator MVP on port 5000...")
    app.run(debug=True, port=5000)
