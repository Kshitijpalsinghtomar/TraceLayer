import { useNavigate } from 'react-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Plus, ArrowUpRight, Database, FileText, Users, Clock, FolderOpen, Trash2, MoreVertical, AlertTriangle, Search, Filter, LayoutGrid, List } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  uploading: { label: 'Uploading', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' },
  processing: { label: 'Processing', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
  extracted: { label: 'Extracted', className: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400' },
  generating: { label: 'Generating', className: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400' },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' },
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' },
};

type ViewMode = 'grid' | 'list';
type SortOption = 'updated' | 'name' | 'created';

export function ProjectsListView() {
  const navigate = useNavigate();
  const projects = useQuery(api.projects.list);
  const deleteProject = useMutation(api.projects.remove);
  
  const [projectToDelete, setProjectToDelete] = useState<{ id: Id<"projects">; name: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const handleDeleteClick = (project: { _id: Id<"projects">; name: string }) => {
    setProjectToDelete(project);
    setShowDeleteDialog(true);
    setMenuOpen(null);
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      await deleteProject({ projectId: projectToDelete.id });
      setProjectToDelete(null);
      setShowDeleteDialog(false);
    }
  };

  // Filter and sort projects
  const filteredProjects = projects?.filter(project => {
    const matchesSearch = 
      project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  }) || [];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'uploading', label: 'Uploading' },
    { value: 'processing', label: 'Processing' },
    { value: 'extracted', label: 'Extracted' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="px-10 py-8 max-w-[1200px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-[28px] tracking-[-0.02em] font-semibold">Projects</h1>
          <p className="text-[15px] text-muted-foreground mt-0.5">
            {projects ? `${projects.length} project${projects.length !== 1 ? 's' : ''} total` : 'Loading projects...'}
          </p>
        </div>
        <button
          onClick={() => navigate('/projects/new')}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-[14px] font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </motion.div>

      {/* Search and filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-[14px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-card border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary/30"
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-4 py-2.5 bg-card border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary/30"
        >
          <option value="updated">Last Updated</option>
          <option value="name">Name</option>
          <option value="created">Created Date</option>
        </select>

        {/* View mode toggle */}
        <div className="flex items-center bg-muted/50 rounded-xl p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-card shadow-sm' : 'hover:bg-muted'}`}
          >
            <List className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-card shadow-sm' : 'hover:bg-muted'}`}
          >
            <LayoutGrid className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {projects === undefined ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border p-6 animate-pulse flex items-center gap-6">
              <div className="w-1 h-12 rounded-full bg-muted shrink-0" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card rounded-2xl border border-border p-16 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-[18px] tracking-[-0.01em] font-semibold mb-2">
            {searchQuery || statusFilter !== 'all' ? 'No matching projects' : 'No projects yet'}
          </h3>
          <p className="text-[14px] text-muted-foreground max-w-[400px] mx-auto mb-6">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'Create your first project to start extracting requirements from emails, meeting transcripts, and chat logs.'
            }
          </p>
          {searchQuery || statusFilter !== 'all' ? (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-[14px] font-medium hover:bg-primary/90 transition-colors"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={() => navigate('/projects/new')}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-[14px] font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Project
            </button>
          )}
        </motion.div>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-3 gap-4">
          {filteredProjects.map((project, i) => {
            const status = statusLabels[project.status] || statusLabels.draft;
            return (
              <motion.div
                key={project._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="bg-card rounded-2xl border border-border/50 p-5 hover:shadow-lg hover:border-primary/20 transition-all duration-200 group cursor-pointer relative"
                onClick={() => navigate(`/projects/${project._id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === project._id ? null : project._id);
                    }}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                
                <h3 className="text-[15px] font-semibold mb-1 truncate">{project.name}</h3>
                <p className="text-[13px] text-muted-foreground line-clamp-2 mb-4">{project.description}</p>
                
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-[12px] text-muted-foreground pt-3 border-t border-border">
                  <span className="flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    {project.sourceCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {project.requirementCount}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <Clock className="w-3 h-3" />
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Dropdown menu */}
                {menuOpen === project._id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute right-4 top-12 w-40 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${project._id}`);
                        setMenuOpen(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-muted transition-colors text-left"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Open
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick({ id: project._id, name: project.name });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-destructive/10 transition-colors text-left text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-3">
          {filteredProjects.map((project, i) => {
            const status = statusLabels[project.status] || statusLabels.draft;
            return (
              <motion.div
                key={project._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="bg-card rounded-2xl border border-border/50 p-5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all duration-200 flex items-center gap-5 group"
              >
                <div
                  className="w-1 h-14 rounded-full shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/projects/${project._id}`)}>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-[15px] font-semibold">{project.name}</h3>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-[13px] text-muted-foreground line-clamp-1">{project.description}</p>
                </div>
                <div className="flex items-center gap-5 text-[12px] text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    {project.sourceCount}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    {project.requirementCount}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {project.stakeholderCount}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                
                {/* Actions */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === project._id ? null : project._id);
                    }}
                    className="p-2 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  {/* Dropdown menu */}
                  {menuOpen === project._id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute right-0 top-full mt-1 w-48 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden z-10"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project._id}`);
                          setMenuOpen(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-muted transition-colors text-left"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Open Project
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick({ id: project._id, name: project.name });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-destructive/10 transition-colors text-left text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Project
                      </button>
                    </motion.div>
                  )}
                </div>
                
                <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete Project
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This will permanently remove:
              <ul className="mt-2 ml-4 list-disc text-sm text-muted-foreground">
                <li>All uploaded sources and documents</li>
                <li>All extracted requirements, stakeholders, and decisions</li>
                <li>All BRD versions and pipeline history</li>
                <li>All chat messages</li>
              </ul>
              <span className="text-red-500 font-medium">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
