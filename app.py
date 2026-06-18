from flask import Flask, render_template, jsonify, request
import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup
import time

app = Flask(__name__)

# Simple in-memory cache to avoid spamming GCP feeds
feed_cache = {
    'data': None,
    'last_fetched': 0
}
CACHE_DURATION_SECS = 3600  # 1 hour

def parse_feed_content(xml_content):
    # Register namespaces if any, but Atom uses xmlns="http://www.w3.org/2005/Atom"
    root = ET.fromstring(xml_content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    
    # Extract entries
    for entry in root.findall('atom:entry', ns):
        title = entry.find('atom:title', ns)
        date_str = title.text.strip() if title is not None else "Unknown Date"
        
        updated_elem = entry.find('atom:updated', ns)
        updated_str = updated_elem.text.strip() if updated_elem is not None else ""
        
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        if link_elem is None:
            link_elem = entry.find('atom:link', ns)
        link_url = link_elem.attrib.get('href', '').strip() if link_elem is not None else ""
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Parse the HTML content to segment by <h3> headers
        soup = BeautifulSoup(content_html, 'html.parser')
        
        items = []
        current_type = "Update"
        current_content = []
        
        # Traverse elements in order
        for child in soup.children:
            if child.name == 'h3':
                # If we have accumulated content for a previous header, package it
                if current_content:
                    html_snippet = "".join(str(c) for c in current_content).strip()
                    text_snippet = BeautifulSoup(html_snippet, 'html.parser').get_text().strip()
                    items.append({
                        'type': current_type,
                        'html': html_snippet,
                        'text': text_snippet
                    })
                current_type = child.get_text().strip()
                current_content = []
            elif child.name is not None:
                current_content.append(child)
                
        # Package the final accumulated item
        if current_content:
            html_snippet = "".join(str(c) for c in current_content).strip()
            text_snippet = BeautifulSoup(html_snippet, 'html.parser').get_text().strip()
            items.append({
                'type': current_type,
                'html': html_snippet,
                'text': text_snippet
            })
            
        # If no items were parsed but there was some text, keep it as single general note
        if not items and content_html.strip():
            items.append({
                'type': 'Update',
                'html': content_html,
                'text': soup.get_text().strip()
            })
            
        entries.append({
            'date': date_str,
            'updated': updated_str,
            'link': link_url,
            'items': items
        })
        
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    if force_refresh or not feed_cache['data'] or (current_time - feed_cache['last_fetched'] > CACHE_DURATION_SECS):
        try:
            url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            parsed_data = parse_feed_content(response.content)
            
            # Update cache
            feed_cache['data'] = parsed_data
            feed_cache['last_fetched'] = current_time
            
        except Exception as e:
            # If request fails, return cached data if available, else error
            if feed_cache['data']:
                return jsonify({
                    'status': 'warning',
                    'message': f'Failed to fetch latest feed ({str(e)}). Serving stale cached data.',
                    'data': feed_cache['data'],
                    'cached_at': feed_cache['last_fetched']
                })
            return jsonify({
                'status': 'error',
                'message': f'Failed to fetch release notes: {str(e)}'
            }), 500

    return jsonify({
        'status': 'success',
        'data': feed_cache['data'],
        'cached_at': feed_cache['last_fetched']
    })

if __name__ == '__main__':
    app.run(debug=True, port=8000)
