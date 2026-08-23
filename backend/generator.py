import os
import google.generativeai as genai

def generate_social_post(trend_data):
    """Generates a social media post using Gemini based on the trend."""
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        print("Warning: No GEMINI_API_KEY found. Returning mock data.")
        return mock_generation(trend_data)
        
    try:
        genai.configure(api_key=api_key)
        # Using gemini-1.5-flash for speed
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        You are an expert social media manager. I will give you a trending tech news story.
        Your job is to write a catchy, engaging social media post (like for Twitter or LinkedIn) about it.
        Include relevant emojis and 3-4 hashtags. Keep it under 280 characters.
        
        Trend Title: {trend_data['title']}
        Trend URL: {trend_data['url']}
        """
        
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Error generating content: {e}")
        return mock_generation(trend_data)

def mock_generation(trend_data):
    return f"🚀 Just saw this trending: '{trend_data['title']}'! The pace of innovation right now is incredible. Check it out here: {trend_data.get('url', 'Link unavailable')} #TechNews #Innovation #Trending"
