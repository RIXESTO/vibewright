import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';

function getDomain(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return 'Source';
    }
}

function Home() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:5001/api/posts')
            .then(res => res.json())
            .then(data => {
                setPosts(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="loader" style={{margin:'2rem auto'}}></div>;

    return (
        <div className="feed-section">
            {/* Informative Pipeline Stats Banner */}
            <div className="pipeline-banner">
                <div className="banner-item">
                    <span className="banner-title">🔍 Discovery</span>
                    <span className="banner-value">Firecrawl (Domain Deduplicated)</span>
                </div>
                <div className="banner-item">
                    <span className="banner-title">🧠 RAG Storage</span>
                    <span className="banner-value">Weaviate Vector DB</span>
                </div>
                <div className="banner-item">
                    <span className="banner-title">🤖 AI Reasoning</span>
                    <span className="banner-value">OpenAI gpt-4o / Gemini</span>
                </div>
                <div className="banner-item">
                    <span className="banner-title">📂 Storage</span>
                    <span className="banner-value">MongoDB Atlas</span>
                </div>
            </div>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
                <h2>Chronological AI Feed ({posts.length} Articles)</h2>
            </div>

            <div className="posts-container">
                {posts.length === 0 ? <p>No posts available.</p> : posts.map(post => {
                    const domains = Array.from(new Set((post.sources || []).map(getDomain)));
                    
                    return (
                        <div key={post._id || post.id || post.slug} className="post-card">
                            <img 
                                src={post.image_url && post.image_url.startsWith('http') ? post.image_url : 'https://loremflickr.com/1200/630/technology'} 
                                alt={post.title} 
                                className="post-media" 
                                onError={(e) => { 
                                    e.target.onerror = null; 
                                    e.target.src = 'https://loremflickr.com/1200/630/technology'; 
                                }}
                            />
                            
                            <h3><Link to={`/post/${post.slug}`} style={{color: 'white', textDecoration: 'none'}}>{post.title}</Link></h3>
                            
                            {/* Deduplicated Source Chips */}
                            {domains.length > 0 && (
                                <div style={{margin: '0.4rem 0'}}>
                                    <span style={{fontSize:'0.75rem', color: '#94a3b8', marginRight:'0.4rem'}}>Verified Sources:</span>
                                    {domains.map(d => <span key={d} className="source-chip">🌐 {d}</span>)}
                                </div>
                            )}

                            {/* Categorization Badges */}
                            <div className="format-badges">
                                <span className="format-badge">📰 Blog</span>
                                <span className="format-badge">⚡ Short-Form</span>
                                <span className="format-badge">🧵 Thread</span>
                                <span className="format-badge">📸 Caption</span>
                            </div>

                            <p className="snippet">{(post.short_form || post.body || '').substring(0, 160)}...</p>
                            
                            <div className="post-tags">
                                {(post.tags || []).map(tag => <span key={tag} className="post-tag">#{tag}</span>)}
                            </div>
                            
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem'}}>
                                <span className="post-time">{new Date(post.created_at).toLocaleString()}</span>
                                <Link to={`/post/${post.slug}`} className="read-more-btn" style={{color: '#9d72ff', fontWeight: 'bold', textDecoration: 'none'}}>Explore 4 Categories →</Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PostView() {
    const { slug } = useParams();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('blog');

    useEffect(() => {
        fetch(`http://localhost:5001/api/posts/${slug}`)
            .then(res => res.json())
            .then(data => {
                setPost(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [slug]);

    if (loading) return <div className="loader" style={{margin:'2rem auto'}}></div>;
    if (!post || post.error) return <p>Post not found.</p>;

    const hasCategories = !!(post.blog || post.short_form || post.thread || post.caption);

    return (
        <article className="full-post glass-panel">
            <div style={{display:'flex', gap:'0.8rem', alignItems:'center', flexWrap:'wrap'}}>
                <div className="trending-badge">📈 RAG Verified</div>
                <span style={{fontSize:'0.85rem', color: '#94a3b8'}}>Published on {new Date(post.created_at).toLocaleString()}</span>
            </div>

            <h1>{post.title}</h1>
            
            <img 
                src={post.image_url && post.image_url.startsWith('http') ? post.image_url : 'https://loremflickr.com/1200/630/technology'} 
                alt={post.title} 
                className="post-media large" 
                onError={(e) => { 
                    e.target.onerror = null; 
                    e.target.src = 'https://loremflickr.com/1200/630/technology'; 
                }}
            />

            {/* Interactive Category Selector */}
            {hasCategories && (
                <div className="category-tabs">
                    <button className={`tab-btn ${activeTab === 'blog' ? 'active' : ''}`} onClick={() => setActiveTab('blog')}>📰 Blog Post</button>
                    <button className={`tab-btn ${activeTab === 'short' ? 'active' : ''}`} onClick={() => setActiveTab('short')}>⚡ Short-Form Summary</button>
                    <button className={`tab-btn ${activeTab === 'thread' ? 'active' : ''}`} onClick={() => setActiveTab('thread')}>🧵 Twitter / X Thread</button>
                    <button className={`tab-btn ${activeTab === 'caption' ? 'active' : ''}`} onClick={() => setActiveTab('caption')}>📸 Social Caption</button>
                    <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>📑 View All Formats</button>
                </div>
            )}

            <div className="content-display-box">
                {hasCategories ? (
                    <>
                        {(activeTab === 'blog' || activeTab === 'all') && (
                            <div className="content-section" style={{marginBottom: activeTab === 'all' ? '2.5rem' : '0'}}>
                                <h2 style={{color:'#a855f7', marginBottom:'1rem'}}>📰 Blog Article</h2>
                                {(post.blog || '').split('\n').map((line, i) => <p key={i}>{line}</p>)}
                            </div>
                        )}

                        {(activeTab === 'short' || activeTab === 'all') && (
                            <div className="content-section" style={{marginBottom: activeTab === 'all' ? '2.5rem' : '0'}}>
                                <h2 style={{color:'#6366f1', marginBottom:'1rem'}}>⚡ Short-Form Summary</h2>
                                <p style={{fontSize:'1.15rem', lineHeight:'1.8', background:'rgba(99,102,241,0.1)', padding:'1rem', borderRadius:'12px', borderLeft:'4px solid #6366f1'}}>
                                    {post.short_form}
                                </p>
                            </div>
                        )}

                        {(activeTab === 'thread' || activeTab === 'all') && (
                            <div className="content-section" style={{marginBottom: activeTab === 'all' ? '2.5rem' : '0'}}>
                                <h2 style={{color:'#38bdf8', marginBottom:'1rem'}}>🧵 X / Twitter Thread</h2>
                                {(post.thread || '').split('\n').map((line, i) => (
                                    <p key={i} style={{margin:'0.6rem 0', padding:'0.6rem 1rem', background:'rgba(56,189,248,0.08)', borderRadius:'8px'}}>
                                        {line}
                                    </p>
                                ))}
                            </div>
                        )}

                        {(activeTab === 'caption' || activeTab === 'all') && (
                            <div className="content-section">
                                <h2 style={{color:'#ec4899', marginBottom:'1rem'}}>📸 Social Media Caption</h2>
                                <p style={{fontSize:'1.1rem', background:'rgba(236,72,153,0.1)', padding:'1rem', borderRadius:'12px', borderLeft:'4px solid #ec4899'}}>
                                    {post.caption}
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    /* Fallback for legacy post body */
                    (post.body || '').split('\n').map((line, i) => <p key={i}>{line}</p>)
                )}
            </div>

            {/* Informative RAG Grounding & Sources */}
            <div className="post-meta-section">
                <h3>🔍 RAG Grounding & Verified Sources</h3>
                <p style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem'}}>
                    Content synthesized strictly from deduplicated source domain documents retrieved from Weaviate vector database:
                </p>
                <ul>
                    {(post.sources || []).map((src, i) => (
                        <li key={i}>
                            <a href={src} target="_blank" rel="noopener noreferrer">{src}</a>
                            <span style={{marginLeft: '0.5rem', fontSize: '0.8rem', color: '#10b981'}}>({getDomain(src)})</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="post-meta-section">
                <h3>📌 Key Takeaways</h3>
                <ul>
                    {(post.key_points || []).map((pt, i) => <li key={i}>{pt}</li>)}
                </ul>
            </div>

            <Link to="/" className="back-link">← Back to Feed</Link>
        </article>
    );
}

function Admin() {
    const [logs, setLogs] = useState([]);
    const [triggering, setTriggering] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = () => {
        fetch('http://localhost:5001/api/logs')
            .then(res => res.json())
            .then(setLogs)
            .catch(console.error);
    };

    const runPipeline = async () => {
        setTriggering(true);
        try {
            const res = await fetch('http://localhost:5001/api/trigger-automation', { method: 'POST' });
            await res.json();
            fetchLogs();
            alert("Pipeline run complete! Check logs.");
        } catch (error) {
            alert("Pipeline failed to trigger.");
        }
        setTriggering(false);
    };

    return (
        <div className="admin-section glass-panel">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2>Pipeline Admin & Observability</h2>
                <button className="glow-on-hover" onClick={runPipeline} disabled={triggering}>
                    {triggering ? "Running..." : "Manual 'Run Now' Trigger"}
                </button>
            </div>
            
            <table className="logs-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Message</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map(log => (
                        <tr key={log._id || log.id} className={log.status === 'error' ? 'error-row' : ''}>
                            <td>{new Date(log.created_at).toLocaleString()}</td>
                            <td>{log.run_type}</td>
                            <td><span className={`status-badge ${log.status}`}>{log.status}</span></td>
                            <td>{log.message}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function App() {
    return (
        <Router>
            <div className="background-shapes">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
                <div className="shape shape-3"></div>
            </div>
            
            <div className="container">
                <header>
                    <div className="logo">
                        <span className="logo-icon">✨</span>
                        <h1><Link to="/" style={{color:'inherit', textDecoration:'none'}}>Swytchcode AI Press</Link></h1>
                    </div>
                    <nav>
                        <Link to="/" className="nav-link">Feed</Link>
                        <Link to="/admin" className="nav-link">Admin Logs</Link>
                    </nav>
                </header>

                <main>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/post/:slug" element={<PostView />} />
                        <Route path="/admin" element={<Admin />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
