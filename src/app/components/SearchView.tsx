import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  ArrowLeft,
  FolderOpen,
  FileText,
  Users,
  MessageSquare,
  Settings,
  HelpCircle,
  ChevronRight,
  X,
  Clock,
  BarChart3,
  ArrowUpRight,
  Layers,
} from 'lucide-react';

type SearchCategory = 'all' | 'projects' | 'requirements' | 'documents' | 'chat';

interface SearchResult {
  id: string;
  type: 'project' | 'requirement' | 'document' | 'chat' | 'page';
  title: string;
  description: string;
  icon: any;
  href: string;
  timestamp?: string;
}

export function SearchView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Fetch data for search
  const projects = useQuery(api.projects.list);
  const allRequirements = useQuery(api.requirements.list);
  const allDocuments = useQuery(api.documents.list);
  const chats = useQuery(api.chat.list);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Save to recent searches
  const saveToRecent = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Update URL when query changes
  useEffect(() => {
    if (query) {
      setSearchParams({ q: query });
    } else {
      setSearchParams({});
    }
  }, [query, setSearchParams]);

  // Filter results based on query and category
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];

    const searchLower = query.toLowerCase();
    const allResults: SearchResult[] = [];

    // Search projects
    if (category === 'all' || category === 'projects') {
      projects?.forEach((project: any) => {
        if (
          project.name?.toLowerCase().includes(searchLower) ||
          project.description?.toLowerCase().includes(searchLower)
        ) {
          allResults.push({
            id: project._id,
            type: 'project',
            title: project.name,
            description: project.description || 'No description',
            icon: FolderOpen,
            href: `/projects/${project._id}`,
            timestamp: project.updatedAt,
          });
        }
      });
    }

    // Search requirements
    if (category === 'all' || category === 'requirements') {
      allRequirements?.forEach((req: any) => {
        if (
          req.content?.toLowerCase().includes(searchLower) ||
          req.title?.toLowerCase().includes(searchLower)
        ) {
          allResults.push({
            id: req._id,
            type: 'requirement',
            title: req.title || 'Untitled Requirement',
            description: req.content?.slice(0, 100) || 'No content',
            icon: FileText,
            href: `/projects/${req.projectId}/brd`,
            timestamp: req.updatedAt,
          });
        }
      });
    }

    // Search documents
    if (category === 'all' || category === 'documents') {
      allDocuments?.forEach((doc: any) => {
        if (
          doc.name?.toLowerCase().includes(searchLower) ||
          doc.content?.toLowerCase().includes(searchLower)
        ) {
          allResults.push({
            id: doc._id,
            type: 'document',
            title: doc.name,
            description: doc.type || 'Document',
            icon: Layers,
            href: `/projects/${doc.projectId}/brd`,
            timestamp: doc.createdAt,
          });
        }
      });
    }

    // Search chat messages
    if (category === 'all' || category === 'chat') {
      chats?.forEach((chat: any) => {
        if (chat.messages) {
          chat.messages.forEach((msg: any) => {
            if (msg.content?.toLowerCase().includes(searchLower)) {
              allResults.push({
                id: `${chat._id}-${msg.timestamp}`,
                type: 'chat',
                title: `Chat in project`,
                description: msg.content?.slice(0, 100) || 'No content',
                icon: MessageSquare,
                href: `/projects/${chat.projectId}`,
                timestamp: msg.timestamp,
              });
            }
          });
        }
      });
    }

    // Add quick links
    const quickLinks: SearchResult[] = [
      { id: 'home', type: 'page', title: 'Dashboard', description: 'Go to dashboard', icon: Layers, href: '/' },
      { id: 'projects', type: 'page', title: 'Projects', description: 'View all projects', icon: FolderOpen, href: '/projects' },
      { id: 'settings', type: 'page', title: 'Settings', description: 'Account settings', icon: Settings, href: '/settings' },
      { id: 'help', type: 'page', title: 'Help & Support', description: 'Get help', icon: HelpCircle, href: '/help' },
      { id: 'integrations', type: 'page', title: 'Integrations', description: 'Manage integrations', icon: Users, href: '/integrations' },
    ].filter(item => 
      item.title.toLowerCase().includes(searchLower) || 
      item.description.toLowerCase().includes(searchLower)
    );

    return [...quickLinks, ...allResults];
  }, [query, category, projects, allRequirements, allDocuments, chats]);

  const categories: { id: SearchCategory; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: results.length },
    { id: 'projects', label: 'Projects', count: results.filter(r => r.type === 'project').length },
    { id: 'requirements', label: 'Requirements', count: results.filter(r => r.type === 'requirement').length },
    { id: 'documents', label: 'Documents', count: results.filter(r => r.type === 'document').length },
    { id: 'chat', label: 'Chat', count: results.filter(r => r.type === 'chat').length },
  ];

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    saveToRecent(searchQuery);
  };

  const clearSearch = () => {
    setQuery('');
    setSearchParams({});
  };

  return (
    <div className="px-10 py-8 max-w-[900px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-[28px] tracking-[-0.02em]">Search</h1>
            <p className="text-[15px] text-muted-foreground mt-1">
              Search across projects, requirements, and documents.
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-6">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                saveToRecent(query);
              }
            }}
            placeholder="Search for projects, requirements, documents..."
            className="w-full pl-14 pr-12 py-4 bg-card border border-border rounded-2xl text-[15px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all"
            autoFocus
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] whitespace-nowrap transition-all ${
                category === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {cat.label}
              {cat.count > 0 && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  category === cat.id 
                    ? 'bg-primary-foreground/20' 
                    : 'bg-muted'
                }`}>
                  {cat.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Results */}
        <AnimatePresence>
          {query.trim() ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {results.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-[15px] text-muted-foreground">No results found for "{query}"</p>
                  <p className="text-[13px] text-muted-foreground/70 mt-1">
                    Try different keywords or check your spelling
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[12px] text-muted-foreground mb-3">
                    {results.length} result{results.length !== 1 ? 's' : ''} found
                  </p>
                  {results.map((result, i) => {
                    const Icon = result.icon;
                    return (
                      <div key={result.id}>
                        <button
                          onClick={() => navigate(result.href)}
                          className="w-full bg-card rounded-xl border border-border/50 p-4 flex items-center gap-4 hover:shadow-md hover:border-primary/20 transition-all text-left group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            result.type === 'project' ? 'bg-blue-50' :
                            result.type === 'requirement' ? 'bg-violet-50' :
                            result.type === 'document' ? 'bg-emerald-50' :
                            result.type === 'chat' ? 'bg-amber-50' :
                            'bg-muted'
                          }`}>
                            <Icon className={`w-5 h-5 ${
                              result.type === 'project' ? 'text-blue-600' :
                              result.type === 'requirement' ? 'text-violet-600' :
                              result.type === 'document' ? 'text-emerald-600' :
                              result.type === 'chat' ? 'text-amber-600' :
                              'text-muted-foreground'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[14px] font-medium truncate">{result.title}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                                result.type === 'project' ? 'bg-blue-50 text-blue-700' :
                                result.type === 'requirement' ? 'bg-violet-50 text-violet-700' :
                                result.type === 'document' ? 'bg-emerald-50 text-emerald-700' :
                                result.type === 'chat' ? 'bg-amber-50 text-amber-700' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {result.type}
                              </span>
                            </div>
                            <p className="text-[13px] text-muted-foreground truncate mt-0.5">
                              {result.description}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Recent searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Recent searches
                    </h3>
                    <button
                      onClick={() => {
                        setRecentSearches([]);
                        localStorage.removeItem('recentSearches');
                      }}
                      className="text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((search, i) => (
                      <button
                        key={i}
                        onClick={() => handleSearch(search)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-[13px] hover:bg-muted transition-colors"
                      >
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div>
                <h3 className="text-[14px] text-muted-foreground mb-3">Quick links</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { title: 'Dashboard', description: 'View your dashboard', icon: Layers, href: '/' },
                    { title: 'Projects', description: 'Browse all projects', icon: FolderOpen, href: '/projects' },
                    { title: 'Settings', description: 'Account settings', icon: Settings, href: '/settings' },
                    { title: 'Help', description: 'Get support', icon: HelpCircle, href: '/help' },
                  ].map((link) => (
                    <button
                      key={link.title}
                      onClick={() => navigate(link.href)}
                      className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3 hover:shadow-md hover:border-primary/20 transition-all text-left group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/6 flex items-center justify-center shrink-0">
                        <link.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[14px] font-medium">{link.title}</p>
                        <p className="text-[12px] text-muted-foreground">{link.description}</p>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="bg-muted/30 rounded-xl p-5">
                <p className="text-[13px] text-muted-foreground mb-2">💡 Search tips</p>
                <ul className="text-[12px] text-muted-foreground space-y-1">
                  <li>• Search for project names, requirements, or document content</li>
                  <li>• Use specific keywords for better results</li>
                  <li>• Press Enter to save your search to recent</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
