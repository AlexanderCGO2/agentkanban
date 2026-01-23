'use client';

import { useState, useMemo } from 'react';
import {
  Artifact,
  ArtifactHeader,
  ArtifactTitle,
  ArtifactActions,
  ArtifactAction,
  ArtifactContent,
  ArtifactClose,
} from '@/components/ai-elements/artifact';
import { CodeBlock } from '@/components/ai-elements/code-block';
import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewUrl,
  WebPreviewBody,
} from '@/components/ai-elements/web-preview';
import { FileTree, FileTreeFolder, FileTreeFile } from '@/components/ai-elements/file-tree';
import {
  Code2Icon,
  EyeIcon,
  DownloadIcon,
  CopyIcon,
  ExternalLinkIcon,
  FolderIcon,
  MaximizeIcon,
} from 'lucide-react';
import type { BundledLanguage } from 'shiki';

export interface ArtifactFile {
  path: string;
  content: string;
  language?: string;
  type?: 'code' | 'html' | 'markdown' | 'json' | 'text';
}

interface AgentArtifactProps {
  title: string;
  description?: string;
  files: ArtifactFile[];
  sessionId?: string;
  onClose?: () => void;
}

function getLanguageFromPath(path: string): BundledLanguage {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, BundledLanguage> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'yml': 'yaml',
    'yaml': 'yaml',
    'xml': 'xml',
    'svg': 'xml',
    'txt': 'text' as BundledLanguage,
  };
  return languageMap[ext] || ('text' as BundledLanguage);
}

function getFileType(path: string): 'code' | 'html' | 'markdown' | 'json' | 'text' {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (ext === 'json') return 'json';
  if (ext === 'md') return 'markdown';
  if (['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'py', 'rb', 'go', 'rs', 'sql', 'sh', 'bash'].includes(ext)) return 'code';
  return 'text';
}

function buildFileTree(files: ArtifactFile[]): { folders: Map<string, ArtifactFile[]>; rootFiles: ArtifactFile[] } {
  const folders = new Map<string, ArtifactFile[]>();
  const rootFiles: ArtifactFile[] = [];

  files.forEach(file => {
    const parts = file.path.split('/');
    if (parts.length === 1) {
      rootFiles.push(file);
    } else {
      const folder = parts.slice(0, -1).join('/');
      if (!folders.has(folder)) {
        folders.set(folder, []);
      }
      folders.get(folder)!.push(file);
    }
  });

  return { folders, rootFiles };
}

export function AgentArtifact({ title, description, files, sessionId, onClose }: AgentArtifactProps) {
  const [selectedFile, setSelectedFile] = useState<ArtifactFile | null>(files[0] || null);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const handleCopy = async () => {
    if (selectedFile) {
      await navigator.clipboard.writeText(selectedFile.content);
    }
  };

  const handleDownload = () => {
    if (selectedFile) {
      const blob = new Blob([selectedFile.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.path.split('/').pop() || 'file.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleOpenExternal = () => {
    if (selectedFile && sessionId) {
      const url = `/api/files/${sessionId}/${selectedFile.path}`;
      window.open(url, '_blank');
    }
  };

  const fileType = selectedFile ? getFileType(selectedFile.path) : 'text';
  const language = selectedFile ? getLanguageFromPath(selectedFile.path) : ('text' as BundledLanguage);
  const canPreview = fileType === 'html';

  const previewUrl = selectedFile && sessionId && canPreview
    ? `/api/files/${sessionId}/${selectedFile.path}`
    : null;

  return (
    <Artifact className={isFullscreen ? 'fixed inset-4 z-50' : 'h-[600px]'}>
      <ArtifactHeader>
        <div className="flex items-center gap-3">
          <ArtifactTitle>{title}</ArtifactTitle>
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
        <ArtifactActions>
          {canPreview && (
            <>
              <ArtifactAction
                tooltip="View Code"
                icon={Code2Icon}
                onClick={() => setViewMode('code')}
                variant={viewMode === 'code' ? 'secondary' : 'ghost'}
              />
              <ArtifactAction
                tooltip="Preview"
                icon={EyeIcon}
                onClick={() => setViewMode('preview')}
                variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
              />
            </>
          )}
          <ArtifactAction tooltip="Copy" icon={CopyIcon} onClick={handleCopy} />
          <ArtifactAction tooltip="Download" icon={DownloadIcon} onClick={handleDownload} />
          {sessionId && (
            <ArtifactAction tooltip="Open in new tab" icon={ExternalLinkIcon} onClick={handleOpenExternal} />
          )}
          <ArtifactAction
            tooltip={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            icon={MaximizeIcon}
            onClick={() => setIsFullscreen(!isFullscreen)}
          />
          {onClose && <ArtifactClose onClick={onClose} />}
        </ArtifactActions>
      </ArtifactHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* File Tree Sidebar */}
        {files.length > 1 && (
          <div className="w-56 border-r bg-muted/30 overflow-auto">
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                <FolderIcon className="h-4 w-4" />
                Files ({files.length})
              </div>
              <FileTree
                selectedPath={selectedFile?.path}
                onSelect={(path) => {
                  const file = files.find(f => f.path === path);
                  if (file) setSelectedFile(file);
                }}
                className="border-0"
              >
                {/* Root files */}
                {fileTree.rootFiles.map(file => (
                  <FileTreeFile
                    key={file.path}
                    path={file.path}
                    name={file.path}
                  />
                ))}
                {/* Folders */}
                {Array.from(fileTree.folders.entries()).map(([folder, folderFiles]) => (
                  <FileTreeFolder key={folder} path={folder} name={folder}>
                    {folderFiles.map(file => (
                      <FileTreeFile
                        key={file.path}
                        path={file.path}
                        name={file.path.split('/').pop() || file.path}
                      />
                    ))}
                  </FileTreeFolder>
                ))}
              </FileTree>
            </div>
          </div>
        )}

        {/* Content Area */}
        <ArtifactContent className="flex-1 p-0">
          {selectedFile && viewMode === 'code' && (
            <CodeBlock
              code={selectedFile.content}
              language={language}
              showLineNumbers
              className="h-full"
            />
          )}

          {selectedFile && viewMode === 'preview' && previewUrl && (
            <WebPreview className="h-full">
              <WebPreviewNavigation>
                <WebPreviewUrl value={previewUrl} readOnly />
              </WebPreviewNavigation>
              <WebPreviewBody src={previewUrl} />
            </WebPreview>
          )}

          {!selectedFile && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No file selected
            </div>
          )}
        </ArtifactContent>
      </div>
    </Artifact>
  );
}

// Simplified single-file artifact for inline display
export function InlineArtifact({
  content,
  language = 'text' as BundledLanguage,
  filename,
  sessionId,
}: {
  content: string;
  language?: BundledLanguage;
  filename?: string;
  sessionId?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileType = filename ? getFileType(filename) : 'text';
  const canPreview = fileType === 'html';
  const previewUrl = filename && sessionId ? `/api/files/${sessionId}/${filename}` : null;

  return (
    <Artifact className="max-h-[400px]">
      {filename && (
        <ArtifactHeader className="py-2">
          <ArtifactTitle className="text-xs font-mono">{filename}</ArtifactTitle>
          <ArtifactActions>
            <ArtifactAction
              tooltip={copied ? 'Copied!' : 'Copy'}
              icon={CopyIcon}
              onClick={handleCopy}
            />
            {canPreview && previewUrl && (
              <ArtifactAction
                tooltip="Preview"
                icon={EyeIcon}
                onClick={() => window.open(previewUrl, '_blank')}
              />
            )}
          </ArtifactActions>
        </ArtifactHeader>
      )}
      <ArtifactContent className="p-0">
        <CodeBlock
          code={content}
          language={language}
          showLineNumbers={content.split('\n').length > 5}
        />
      </ArtifactContent>
    </Artifact>
  );
}
