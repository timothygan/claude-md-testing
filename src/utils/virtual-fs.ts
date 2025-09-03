import { VirtualFile, FileOperation } from '../types';
import * as path from 'path';

export class VirtualFileSystem {
  private files: Map<string, VirtualFile> = new Map();
  private operations: FileOperation[] = [];
  private workingDirectory: string = '/workspace';

  constructor(private readonly rootPath: string = '/workspace') {
    this.workingDirectory = rootPath;
  }

  async write(filePath: string, content: string): Promise<{ success: boolean; bytesWritten: number }> {
    const normalizedPath = this.normalizePath(filePath);
    const timestamp = Date.now();
    
    const file: VirtualFile = {
      path: normalizedPath,
      content,
      createdAt: this.files.get(normalizedPath)?.createdAt || timestamp,
      modifiedAt: timestamp,
      permissions: 'rw-r--r--'
    };
    
    this.files.set(normalizedPath, file);
    
    this.operations.push({
      type: 'write',
      path: normalizedPath,
      content,
      timestamp,
      success: true
    });
    
    return { success: true, bytesWritten: content.length };
  }

  async read(filePath: string): Promise<string | null> {
    const normalizedPath = this.normalizePath(filePath);
    const file = this.files.get(normalizedPath);
    
    this.operations.push({
      type: 'read',
      path: normalizedPath,
      timestamp: Date.now(),
      success: !!file
    });
    
    return file ? file.content : null;
  }

  async edit(filePath: string, oldContent: string, newContent: string): Promise<{ success: boolean; message: string }> {
    const normalizedPath = this.normalizePath(filePath);
    const file = this.files.get(normalizedPath);
    
    if (!file) {
      return { success: false, message: 'File not found' };
    }
    
    if (!file.content.includes(oldContent)) {
      return { success: false, message: 'Old content not found in file' };
    }
    
    const updatedContent = file.content.replace(oldContent, newContent);
    file.content = updatedContent;
    file.modifiedAt = Date.now();
    
    this.operations.push({
      type: 'edit',
      path: normalizedPath,
      content: updatedContent,
      timestamp: Date.now(),
      success: true
    });
    
    return { success: true, message: 'File edited successfully' };
  }

  async delete(filePath: string): Promise<{ success: boolean }> {
    const normalizedPath = this.normalizePath(filePath);
    const success = this.files.delete(normalizedPath);
    
    this.operations.push({
      type: 'delete',
      path: normalizedPath,
      timestamp: Date.now(),
      success
    });
    
    return { success };
  }

  async exists(filePath: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(filePath);
    return this.files.has(normalizedPath);
  }

  async listDirectory(dirPath: string): Promise<string[]> {
    const normalizedDir = this.normalizePath(dirPath);
    const entries: Set<string> = new Set();
    
    for (const [filePath] of this.files) {
      if (filePath.startsWith(normalizedDir)) {
        const relativePath = filePath.slice(normalizedDir.length + 1);
        const parts = relativePath.split('/');
        if (parts[0]) {
          entries.add(parts[0]);
        }
      }
    }
    
    return Array.from(entries);
  }

  getFileOperations(): FileOperation[] {
    return [...this.operations];
  }

  snapshot(): Map<string, VirtualFile> {
    return new Map(this.files);
  }

  reset(): void {
    this.files.clear();
    this.operations = [];
    this.workingDirectory = this.rootPath;
  }

  getStats() {
    return {
      totalFiles: this.files.size,
      totalOperations: this.operations.length,
      operationsByType: this.operations.reduce((acc, op) => {
        acc[op.type] = (acc[op.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalBytes: Array.from(this.files.values()).reduce((sum, file) => sum + file.content.length, 0)
    };
  }

  private normalizePath(filePath: string): string {
    if (!filePath.startsWith('/')) {
      filePath = path.join(this.workingDirectory, filePath);
    }
    return path.normalize(filePath);
  }
}