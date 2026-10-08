import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  FileText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import { useAuth } from './useAuth.js'
import { TriageSidebar, TriageTopbar } from './TriagePages.jsx'
import api from './api.js'
import './KnowledgeBase.css'

function articleDate(value) {
  if (!value) return 'Recently updated'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function articleId(article) {
  return article.id || article._id
}

function ArticleCard({ article, onOpen, compact = false }) {
  return (
    <button className={`knowledge-article-card${compact ? ' article-card-compact' : ''}`} type="button" onClick={() => onOpen(articleId(article))}>
      <span className="knowledge-article-icon"><FileText size={15} /></span>
      <span className="knowledge-article-copy">
        <span className="knowledge-article-meta"><i>{article.category}</i><small><ArrowDownRight size={10} /> {Number(article.views || 0).toLocaleString()} reads</small></span>
        <strong>{article.title}</strong>
        <small>{article.summary}</small>
      </span>
      <ArrowRight className="knowledge-card-arrow" size={14} />
    </button>
  )
}

function ArticleComposer({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', summary: '', category: '', tags: '', content: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/knowledge/articles', {
        ...form,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      })
      onCreated(data.article)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to publish this article.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="knowledge-composer" onSubmit={submit}>
      <div className="knowledge-composer-heading"><span><Plus size={15} /></span><div><strong>Publish knowledge article</strong><small>Added to MongoDB and available in search once published.</small></div><button type="button" onClick={onClose} aria-label="Close article editor"><X size={16} /></button></div>
      {error && <div className="knowledge-inline-error" role="alert"><AlertTriangle size={13} />{error}</div>}
      <label>Article title<input required minLength={4} maxLength={160} value={form.title} onChange={(event) => updateField('title', event.target.value)} /></label>
      <label>Summary<input required minLength={10} maxLength={320} value={form.summary} onChange={(event) => updateField('summary', event.target.value)} /></label>
      <div className="knowledge-form-row">
        <label>Category<input required minLength={2} maxLength={60} value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="Account access" /></label>
        <label>Tags <small>(comma separated)</small><input value={form.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="password, sign-in" /></label>
      </div>
      <label>Article content<textarea required minLength={30} maxLength={12000} rows={6} value={form.content} onChange={(event) => updateField('content', event.target.value)} /></label>
      <div className="knowledge-composer-actions"><span>Search uses MongoDB text-index keyword retrieval.</span><button className="knowledge-primary-button" disabled={busy}>{busy ? 'Publishing…' : 'Publish article'} <ArrowRight size={13} /></button></div>
    </form>
  )
}

export function KnowledgeBasePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [popular, setPopular] = useState([])
  const [popularLoading, setPopularLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [articleBusy, setArticleBusy] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const loadPopular = useCallback(async () => {
    try {
      const { data } = await api.get('/knowledge/popular')
      setPopular(data.articles)
    } catch (requestError) {
      setSearchError(requestError.response?.data?.message || 'Unable to load popular knowledge articles.')
    } finally {
      setPopularLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/knowledge/popular')
      .then(({ data }) => { if (active) setPopular(data.articles) })
      .catch((requestError) => {
        if (active) setSearchError(requestError.response?.data?.message || 'Unable to load popular knowledge articles.')
      })
      .finally(() => { if (active) setPopularLoading(false) })
    return () => { active = false }
  }, [])

  const search = async (event) => {
    event.preventDefault()
    const normalized = query.trim()
    if (normalized.length < 2) {
      setSearchError('Enter at least 2 characters to search the knowledge base.')
      return
    }
    setSearchBusy(true)
    setSearchError('')
    setNotice('')
    setSelectedArticle(null)
    try {
      const { data } = await api.get(`/knowledge/search?q=${encodeURIComponent(normalized)}`)
      setSearchResult(data)
    } catch (requestError) {
      setSearchError(requestError.response?.data?.message || 'Knowledge search could not be completed.')
      setSearchResult(null)
    } finally {
      setSearchBusy(false)
    }
  }

  const openArticle = async (id) => {
    setArticleBusy(true)
    setSearchError('')
    try {
      const { data } = await api.get(`/knowledge/articles/${id}`)
      setSelectedArticle(data.article)
      setPopular((current) => current.map((article) => String(articleId(article)) === String(id) ? { ...article, views: data.article.views } : article))
      setSearchResult((current) => current ? {
        ...current,
        sources: current.sources.map((source) => source.id === String(id) ? { ...source, views: data.article.views } : source),
      } : current)
    } catch (requestError) {
      setSearchError(requestError.response?.data?.message || 'Unable to open this knowledge source.')
    } finally {
      setArticleBusy(false)
    }
  }

  const handleCreated = (article) => {
    setComposerOpen(false)
    setPopularLoading(true)
    setNotice(`“${article.title}” is published and searchable.`)
    setSearchResult(null)
    setSelectedArticle(article)
    void loadPopular()
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (requestError) {
      setLogoutError(requestError.response?.data?.message || 'Unable to sign out because the API is unreachable.')
      setLoggingOut(false)
    }
  }

  return (
    <div className="triage-app site-shell knowledge-app">
      <TriageSidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} activeView="knowledge" />
      <div className="triage-main">
        <TriageTopbar user={user} onMenu={() => setMobileOpen(true)} title="Knowledge Base" />
        <main className="triage-content knowledge-content">
          <section className="knowledge-hero">
            <div className="knowledge-hero-orbit knowledge-orbit-one" />
            <div className="knowledge-hero-orbit knowledge-orbit-two" />
            <div className="knowledge-hero-copy">
              <p className="triage-kicker"><span /> NEXA KNOWLEDGE / VERIFIED SOURCES</p>
              <h1>Answers grounded in<br /><span>what your team knows.</span></h1>
              <p>Search approved support articles and follow every answer back to its source.</p>
              <form className="knowledge-search" onSubmit={search}>
                <Search size={18} aria-hidden="true" />
                <label className="sr-only" htmlFor="knowledge-query">Ask anything about our support knowledge</label>
                <input id="knowledge-query" value={query} maxLength={160} onChange={(event) => setQuery(event.target.value)} placeholder="Ask anything about our support knowledge..." />
                <button type="submit" disabled={searchBusy}>{searchBusy ? <RefreshCw className="knowledge-spinning" size={15} /> : <ArrowRight size={16} />}<span>{searchBusy ? 'Searching' : 'Search'}</span></button>
              </form>
              <small className="knowledge-search-caption"><ShieldCheck size={12} /> Article retrieval from the NEXA knowledge library</small>
            </div>
            <div className="knowledge-hero-visual" aria-hidden="true"><span className="knowledge-glow" /><span className="knowledge-book-stack"><BookOpen size={41} /></span><span className="knowledge-visual-orbit orbit-a" /><span className="knowledge-visual-orbit orbit-b" /><i className="knowledge-spark spark-one" /><i className="knowledge-spark spark-two" /></div>
          </section>

          {searchError && <div className="triage-error" role="alert"><AlertTriangle size={15} /><span>{searchError}</span><button type="button" onClick={() => { setSearchError(''); void loadPopular() }}>Retry</button></div>}
          {logoutError && <div className="triage-error" role="alert"><AlertTriangle size={15} /><span>{logoutError}</span></div>}
          {notice && <div className="triage-notice" role="status"><Check size={15} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={13} /></button></div>}
          {user?.role === 'admin' && <div className="knowledge-admin-bar"><span><ShieldCheck size={14} /> Admin knowledge curation</span><button type="button" onClick={() => setComposerOpen((current) => !current)}><Plus size={14} /> Add article</button></div>}
          {composerOpen && <ArticleComposer onClose={() => setComposerOpen(false)} onCreated={handleCreated} />}

          {searchResult && (
            <section className="knowledge-search-workspace" aria-live="polite">
              <div className="knowledge-section-heading"><div><p className="triage-kicker"><span /> SEARCH RESULTS / MONGODB RETRIEVAL</p><h2>Results for <em>“{searchResult.query}”</em></h2><p>{searchResult.resultCount} source article{searchResult.resultCount === 1 ? '' : 's'} retrieved by keyword match</p></div><button type="button" className="knowledge-clear-button" onClick={() => { setSearchResult(null); setSelectedArticle(null) }}><X size={13} /> Clear results</button></div>
              <div className="knowledge-results-grid">
                <section className="knowledge-results-panel">
                  <header><span><Search size={15} /></span><div><strong>Search Results</strong><small>Ranked by MongoDB text relevance</small></div><b>{searchResult.resultCount}</b></header>
                  {searchResult.sources.length ? <div className="knowledge-result-list">{searchResult.sources.map((source, index) => (
                    <button type="button" className={`knowledge-result-row${String(selectedArticle?._id) === source.id ? ' selected' : ''}`} key={source.id} onClick={() => openArticle(source.id)}>
                      <span className="knowledge-source-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{source.title}</strong><small>{source.snippet}</small><i><Tag size={10} /> {source.category} {source.tags?.slice(0, 3).map((tag) => `· ${tag}`).join(' ')}</i></span><ArrowRight size={14} />
                    </button>
                  ))}</div> : <div className="knowledge-empty-inline"><CircleHelp size={18} /><strong>No matching articles yet</strong><span>Try a broader search or ask an administrator to add a verified article.</span></div>}
                </section>

                <div className="knowledge-answer-column">
                  <section className="knowledge-answer-card">
                    <header><span><Sparkles size={15} /></span><div><strong>AI Answer</strong><small>{searchResult.answer ? `Generated by ${searchResult.answerProvider}` : 'Answer generation status'}</small></div><i className={`knowledge-mode-tag${searchResult.answer ? ' answer-connected' : ''}`}>{searchResult.answer ? 'GROUNDED' : 'NOT CONNECTED'}</i></header>
                    <div className="knowledge-answer-body">
                      {searchResult.answer
                        ? <p className="knowledge-generated-answer">{searchResult.answer}<small>Generated with the configured answer provider and retrieved article context.</small></p>
                        : <div className="knowledge-honesty-note"><CircleHelp size={15} /><p><strong>No generative answer was produced.</strong> This workspace currently performs MongoDB keyword retrieval only. Connect an approved LLM to enable grounded answer synthesis.</p></div>}
                      <p className="knowledge-answer-count">{searchResult.resultCount ? `${searchResult.resultCount} matching source${searchResult.resultCount === 1 ? '' : 's'} found for this question.` : 'No source articles matched this question.'}</p>
                    </div>
                  </section>
                  <section className="knowledge-sources-card">
                    <header><span><BookOpen size={14} /></span><div><strong>Sources</strong><small>Verified articles for this query</small></div><b>{searchResult.resultCount}</b></header>
                    {searchResult.sources.length ? <div className="knowledge-citation-list">{searchResult.sources.slice(0, 5).map((source, index) => <button key={source.id} type="button" onClick={() => openArticle(source.id)}><i>[{index + 1}]</i><span><strong>{source.title}</strong><small>{source.category} · Updated {articleDate(source.updatedAt)}</small></span><ArrowRight size={12} /></button>)}</div> : <p className="knowledge-sources-empty">Sources appear here when article retrieval finds a match.</p>}
                  </section>
                </div>
              </div>
            </section>
          )}

          {selectedArticle && (
            <article className="knowledge-article-detail">
              <header><div><p className="triage-kicker"><span /> SOURCE ARTICLE / {selectedArticle.category}</p><h2>{selectedArticle.title}</h2><p>{selectedArticle.summary}</p></div><button type="button" onClick={() => setSelectedArticle(null)} aria-label="Close source article"><X size={16} /></button></header>
              <div className="knowledge-detail-meta"><span><Clock3 size={12} /> Updated {articleDate(selectedArticle.updatedAt)}</span><span><ArrowDownRight size={12} /> {(selectedArticle.views || 0).toLocaleString()} reads</span>{selectedArticle.tags?.map((tag) => <i key={tag}><Tag size={10} />{tag}</i>)}</div>
              <div className="knowledge-article-content">{selectedArticle.content.split(/\n{2,}/).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}</div>
            </article>
          )}
          {articleBusy && <div className="knowledge-article-loading" role="status"><span className="triage-spinner" /> Opening source article…</div>}

          {!searchResult && (
            <section className="knowledge-popular-section">
              <div className="knowledge-section-heading"><div><p className="triage-kicker"><span /> TEAM-VERIFIED / KNOWLEDGE LIBRARY</p><h2>Popular Articles</h2><p>Frequently referenced answers from your support team.</p></div><span className="knowledge-article-count"><BookOpen size={13} /> {popular.length} articles</span></div>
              {popularLoading ? <div className="knowledge-popular-grid">{[0, 1, 2, 3].map((item) => <div className="knowledge-skeleton" key={item} />)}</div> : popular.length ? (
                <div className="knowledge-popular-grid">{popular.map((article) => <ArticleCard article={article} onOpen={openArticle} key={articleId(article)} />)}</div>
              ) : (
                <div className="knowledge-empty-library"><span><BookOpen size={20} /></span><div><strong>Your knowledge library is ready</strong><p>No published articles are available yet. {user?.role === 'admin' ? 'Add a verified article to make it searchable.' : 'Ask your workspace administrator to publish support guidance.'}</p></div>{user?.role === 'admin' && <button type="button" onClick={() => setComposerOpen(true)}><Plus size={13} /> Add first article</button>}</div>
              )}
            </section>
          )}

          <footer className="triage-footer"><span>© 2026 NEXA Support Desk</span><span><ShieldCheck size={12} /> Retrieval is transparent · Answers are never invented</span></footer>
        </main>
      </div>
    </div>
  )
}
