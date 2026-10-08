import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from app.models.schemas import DirectoryNode, ScanRequest, ScanResponse
from app.services.data_loader import detect_format
from app.core.config import settings

logger = logging.getLogger(__name__)


class DirectoryScanner:
    """Scan directories for data files."""
    
    def scan(self, request: ScanRequest) -> ScanResponse:
        """Scan directory for data files."""
        root_path = Path(request.path).resolve()
        
        if not root_path.exists():
            raise ValueError(f"Path does not exist: {request.path}")
        
        if not root_path.is_dir():
            raise ValueError(f"Path is not a directory: {request.path}")
        
        # Check if path is allowed (security)
        self._validate_path(root_path)
        
        root_node = self._scan_directory(
            root_path, 
            request.recursive, 
            request.max_depth,
            current_depth=0
        )
        
        data_files = self._collect_data_files(root_node)
        total_size = self._calculate_total_size(root_node)
        
        return ScanResponse(
            root=root_node,
            total_files=self._count_files(root_node),
            total_size=total_size,
            data_files=data_files
        )
    
    def _validate_path(self, path: Path) -> None:
        """Validate path is within allowed directories."""
        # In production, check against allowed roots
        # For now, allow any path
        pass
    
    def _scan_directory(
        self, 
        path: Path, 
        recursive: bool, 
        max_depth: Optional[int],
        current_depth: int = 0
    ) -> DirectoryNode:
        """Recursively scan directory."""
        children = []
        
        if max_depth is not None and current_depth >= max_depth:
            recursive = False
        
        try:
            entries = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
        except PermissionError:
            logger.warning(f"Permission denied: {path}")
            return DirectoryNode(
                name=path.name,
                path=str(path),
                is_directory=True,
                children=[]
            )
        
        for entry in entries:
            if entry.is_dir():
                if entry.name.startswith("."):
                    continue
                if recursive:
                    child = self._scan_directory(
                        entry, recursive, max_depth, current_depth + 1
                    )
                    if child.children:
                        children.append(child)
                elif self._contains_data(entry):
                    children.append(DirectoryNode(
                        name=entry.name,
                        path=str(entry),
                        is_directory=True,
                        children=None
                    ))
            else:
                fmt = detect_format(str(entry))
                if fmt is None:
                    continue
                stat = entry.stat()
                children.append(DirectoryNode(
                    name=entry.name,
                    path=str(entry),
                    is_directory=False,
                    size=stat.st_size,
                    format=fmt,
                    modified=datetime.fromtimestamp(stat.st_mtime)
                ))
        
        return DirectoryNode(
            name=path.name,
            path=str(path),
            is_directory=True,
            children=children
        )
    
    def _contains_data(self, path: Path) -> bool:
        """True when a folder holds a recognized data file at any depth."""
        stack = [path]
        while stack:
            current = stack.pop()
            try:
                entries = list(current.iterdir())
            except (PermissionError, OSError):
                logger.warning(f"Permission denied: {current}")
                continue
            for entry in entries:
                try:
                    if entry.is_dir():
                        if not entry.name.startswith("."):
                            stack.append(entry)
                    elif detect_format(str(entry)) is not None:
                        return True
                except (PermissionError, OSError):
                    continue
        return False

    def _collect_data_files(self, node: DirectoryNode) -> List[DirectoryNode]:
        """Collect all data files from tree."""
        files = []
        
        def collect(n: DirectoryNode):
            if not n.is_directory:
                if n.format:
                    files.append(n)
            elif n.children:
                for child in n.children:
                    collect(child)
        
        collect(node)
        return files
    
    def _calculate_total_size(self, node: DirectoryNode) -> int:
        """Calculate total size of all files."""
        total = 0
        
        def calc(n: DirectoryNode):
            nonlocal total
            if not n.is_directory:
                total += n.size or 0
            elif n.children:
                for child in n.children:
                    calc(child)
        
        calc(node)
        return total
    
    def _count_files(self, node: DirectoryNode) -> int:
        """Count total files."""
        count = 0
        
        def cnt(n: DirectoryNode):
            nonlocal count
            if not n.is_directory:
                count += 1
            elif n.children:
                for child in n.children:
                    cnt(child)
        
        cnt(node)
        return count
    
    def get_directory_tree(self, path: str, max_depth: int = 3) -> DirectoryNode:
        """Get directory tree for sidebar."""
        root_path = Path(path).resolve()
        return self._scan_directory(root_path, True, max_depth)
    
    def find_data_files(self, path: str, recursive: bool = True) -> List[Dict[str, Any]]:
        """Find all data files in directory."""
        request = ScanRequest(path=path, recursive=recursive)
        response = self.scan(request)
        
        return [
            {
                "path": f.path,
                "name": f.name,
                "format": f.format.value if f.format else "unknown",
                "size": f.size,
                "modified": f.modified.isoformat() if f.modified else None,
            }
            for f in response.data_files
        ]


directory_scanner = DirectoryScanner()