import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';

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
            <h2>Chronological Feed</h2>
            <div className="posts-container">
                {posts.length === 0 ? <p>No posts available.</p> : posts.map(post => (
                    <div key={post.id} className="post-card">
                        {post.image_url && (
                            <img 
                                src={post.image_url} 
                                alt={post.title} 
                                className="post-media" 
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        )}
                        <h3><Link to={`/post/${post.slug}`} style={{color: 'white', textDecoration: 'none'}}>{post.title}</Link></h3>
                        <p className="snippet">{post.body.substring(0, 150)}...</p>
                        <div className="post-tags">
                            {post.tags.map(tag => <span key={tag} className="post-tag">#{tag}</span>)}
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem'}}>
                            <span className="post-time">{new Date(post.created_at).toLocaleString()}</span>
                            <Link to={`/post/${post.slug}`} className="read-more-btn" style={{color: '#9d72ff', fontWeight: 'bold', textDecoration: 'none'}}>Read Full Article →</Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PostView() {
    const { slug } = useParams();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

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

    return (
        <article className="full-post glass-panel">
            <div className="trending-badge">📈 Trending as of {new Date(post.created_at).toLocaleDateString()}</div>
            <h1>{post.title}</h1>
            {post.image_url && (
                <img 
                    src={post.image_url} 
                    alt={post.title} 
                    className="post-media large" 
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
            )}
            
            <div className="post-body">
                {post.body.split('\\n').map((line, i) => <p key={i}>{line}</p>)}
            </div>

            <div className="post-meta-section">
                <h3>Key Points</h3>
                <ul>
                    {post.key_points.map((pt, i) => <li key={i}>{pt}</li>)}
                </ul>
            </div>

            <div className="post-meta-section">
                <h3>Cited Sources (RAG Grounding)</h3>
                <ul>
                    {post.sources.map((src, i) => (
                        <li key={i}><a href={src} target="_blank" rel="noopener noreferrer">{src}</a></li>
                    ))}
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
                <h2>Pipeline Admin & Logs</h2>
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
                        <tr key={log.id} className={log.status === 'error' ? 'error-row' : ''}>
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
