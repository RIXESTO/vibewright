import requests

def fetch_trending_topic():
    """Fetches the top story from Hacker News API."""
    try:
        # Get top stories
        response = requests.get('https://hacker-news.firebaseio.com/v0/topstories.json')
        response.raise_for_status()
        top_story_id = response.json()[0]
        
        # Get details of the top story
        story_response = requests.get(f'https://hacker-news.firebaseio.com/v0/item/{top_story_id}.json')
        story_response.raise_for_status()
        story_data = story_response.json()
        
        return {
            "title": story_data.get("title", "Unknown Trend"),
            "url": story_data.get("url", ""),
            "source": "Hacker News"
        }
    except Exception as e:
        print(f"Error fetching trend: {e}")
        return {
            "title": "AI Continues to Transform the Tech Industry in 2024",
            "url": "https://example.com/ai-trend",
            "source": "Fallback Data"
        }
