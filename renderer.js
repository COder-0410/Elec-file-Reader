document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded');
  const selectFolderButton = document.getElementById('select-folder-btn');
  const selectedFolderPathElement = document.getElementById('selected-folder-path');
  const fileExplorer = document.getElementById('file-explorer');
  
  console.log('Elements found:', {
    selectFolderButton: !!selectFolderButton,
    selectedFolderPathElement: !!selectedFolderPathElement, 
    fileExplorer: !!fileExplorer
  });
  
  let currentFolderPath = null;

  // Check which API name is exposed in preload.js
  const api = window.api || window.electronAPI;
  
  if (!api) {
    console.error('ERROR: Neither window.api nor window.electronAPI is available!');
    document.body.innerHTML += `
      <div style="color: red; padding: 20px; background: #333; margin: 20px;">
        ERROR: API not available. Check that preload.js is correctly configured.
      </div>
    `;
    return;
  }

  selectFolderButton.addEventListener('click', async () => {
    console.log('Select folder button clicked');
    try {
      console.log('Calling selectFolder()');
      const folderPath = await api.selectFolder();
      console.log('Selected folder:', folderPath);
      
      if (folderPath) {
        currentFolderPath = folderPath;
        selectedFolderPathElement.textContent = folderPath;
        console.log('About to load file tree for path:', folderPath);
        await loadFileTree(folderPath);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      selectedFolderPathElement.textContent = 'Error selecting folder';
    }
  });

  // Group screenshots by date
  function groupScreenshotsByDate(files) {
    const groups = {};
    
    files.forEach(file => {
      if (file.name.startsWith('Screenshot') && file.name.includes('-')) {
        // Extract date from filename (assuming format Screenshot YYYY-MM-DD ...)
        const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const dateStr = dateMatch[1];
          if (!groups[dateStr]) {
            groups[dateStr] = [];
          }
          groups[dateStr].push(file);
        } else {
          // If no date in filename, put in 'Other' category
          if (!groups['Other']) {
            groups['Other'] = [];
          }
          groups['Other'].push(file);
        }
      } else {
        // Non-screenshot files
        if (!groups['Other']) {
          groups['Other'] = [];
        }
        groups['Other'].push(file);
      }
    });
    
    return groups;
  }

  // Load file tree for given path
  async function loadFileTree(folderPath) {
    try {
      console.log('Loading file tree for:', folderPath);
      // Clear current file explorer content
      fileExplorer.innerHTML = '';
      
      // Get directory name for root display
      const folderName = folderPath.split(/[\/\\]/).pop();
      console.log('Root folder name:', folderName);
      
      // Create root folder element
      const rootFolder = createFolderElement(folderName, folderPath, true);
      fileExplorer.appendChild(rootFolder);
      console.log('Root folder element added to DOM');
      
      // Expand root folder automatically
      console.log('Attempting to toggle root folder');
      toggleFolder(rootFolder, true);
      
    } catch (error) {
      console.error('Error loading file tree:', error);
      fileExplorer.innerHTML = '<div class="placeholder-message">Error loading folder contents</div>';
    }
  }
  
  // Create folder element with expandable functionality
  function createFolderElement(name, path, isRoot = false) {
    console.log('Creating folder element:', name, path, isRoot);
    const folderItem = document.createElement('div');
    folderItem.className = 'tree-item folder';
    if (isRoot) {
      folderItem.classList.add('root');
    }
    
    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.textContent = '▶';
    
    const folderIcon = document.createElement('span');
    folderIcon.className = 'icon';
    
    const folderName = document.createElement('span');
    folderName.className = 'name';
    folderName.textContent = name;
    
    folderItem.appendChild(chevron);
    folderItem.appendChild(folderIcon);
    folderItem.appendChild(folderName);
    
    const folderContents = document.createElement('div');
    folderContents.className = 'folder-contents';
    folderContents.dataset.path = path;
    folderContents.dataset.loaded = 'false';
    
    const container = document.createElement('div');
    container.appendChild(folderItem);
    container.appendChild(folderContents);
    
    folderItem.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Folder clicked:', name);
      toggleFolder(container);
    });
    
    return container;
  }
  
  // Create file element with appropriate icon based on file type
  function createFileElement(file) {
    console.log('Creating file element:', file.name);
    const fileItem = document.createElement('div');
    fileItem.className = `tree-item file ${file.extension}`;
    
    const fileIcon = document.createElement('span');
    fileIcon.className = 'icon';
    
    const fileName = document.createElement('span');
    fileName.className = 'name';
    fileName.textContent = file.name;
    
    // Add file meta information (like date if it's a screenshot)
    if (file.name.startsWith('Screenshot')) {
      const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const timeMatch = file.name.match(/(\d{6})/);
        if (timeMatch) {
          const meta = document.createElement('span');
          meta.className = 'item-meta';
          meta.textContent = timeMatch[1].replace(/(\d{2})(\d{2})(\d{2})/, '$1:$2:$3');
          fileItem.appendChild(meta);
        }
      }
    }
    
    fileItem.appendChild(fileIcon);
    fileItem.appendChild(fileName);
    
    return fileItem;
  }
  
  // Toggle folder expand/collapse
  async function toggleFolder(folderContainer, forceExpand = false) {
    console.log('Toggle folder called', forceExpand);
    const folderItem = folderContainer.querySelector('.tree-item.folder');
    const folderContents = folderContainer.querySelector('.folder-contents');
    const chevron = folderItem.querySelector('.chevron');
    
    console.log('Elements found:', {
      folderItem: !!folderItem,
      folderContents: !!folderContents,
      chevron: !!chevron
    });
    
    const isExpanded = folderContents.classList.contains('expanded');
    console.log('Is currently expanded?', isExpanded);
    
    if (isExpanded && !forceExpand) {
      // Collapse
      folderContents.classList.remove('expanded');
      folderItem.classList.remove('expanded');
      chevron.textContent = '▶';
      console.log('Folder collapsed');
    } else {
      // Expand
      folderContents.classList.add('expanded');
      folderItem.classList.add('expanded');
      chevron.textContent = '▼';
      console.log('Folder expanded, now checking if contents need loading');
      
      // Load contents if not loaded yet
      if (folderContents.dataset.loaded === 'false') {
        const path = folderContents.dataset.path;
        console.log('Loading folder contents for path:', path);
        
        try {
          const loadingMsg = document.createElement('div');
          loadingMsg.className = 'placeholder-message';
          loadingMsg.textContent = 'Loading...';
          folderContents.appendChild(loadingMsg);
          
          console.log('Calling api.readDirectory with path:', path);
          const files = await api.readDirectory(path);
          console.log('Got files from readDirectory:', files ? files.length : 'undefined');
          
          // Clear the loading message
          folderContents.innerHTML = '';
          
          if (files && files.length > 0) {
            // For screenshots folder, group by date
            if (path.toLowerCase().includes('screenshots')) {
              const groups = groupScreenshotsByDate(files);
              
              // Add each group
              for (const [date, groupFiles] of Object.entries(groups)) {
                if (date !== 'Other') {
                  // Add date header
                  const dateHeader = document.createElement('div');
                  dateHeader.className = 'date-group';
                  dateHeader.textContent = date;
                  folderContents.appendChild(dateHeader);
                }
                
                // Add files in this group
                groupFiles.forEach(file => {
                  if (file.isDirectory) {
                    const subFolder = createFolderElement(file.name, file.path);
                    folderContents.appendChild(subFolder);
                  } else {
                    const fileElement = createFileElement(file);
                    folderContents.appendChild(fileElement);
                  }
                });
              }
            } else {
              // Regular folder, just add files normally
              files.forEach(file => {
                console.log('Processing file:', file.name, 'isDirectory:', file.isDirectory);
                if (file.isDirectory) {
                  const subFolder = createFolderElement(file.name, file.path);
                  folderContents.appendChild(subFolder);
                } else {
                  const fileElement = createFileElement(file);
                  folderContents.appendChild(fileElement);
                }
              });
            }
          } else {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'placeholder-message';
            emptyMsg.textContent = 'Empty folder';
            folderContents.appendChild(emptyMsg);
          }
          
          folderContents.dataset.loaded = 'true';
          console.log('Folder contents loaded successfully');
        } catch (error) {
          console.error('Error loading folder contents:', error);
          folderContents.innerHTML = '<div class="placeholder-message">Error loading contents</div>';
        }
      } else {
        console.log('Folder contents were already loaded');
      }
    }
  }
  
  console.log('Renderer script initialization complete');
});

function shouldHideFile(file) {
  // List of files to hide
  const hiddenFiles = [
    'desktop.ini',
    'thumbs.db',
    '.ds_store',
    '$recycle.bin',
    'system volume information'
  ];
  
  // Check if the filename is in our hidden files list (case insensitive)
  return hiddenFiles.some(hiddenFile => 
    file.name.toLowerCase() === hiddenFile.toLowerCase()
  );
}

// Modify your organizeFiles function to filter hidden files
function organizeFiles(files) {
  // First filter out hidden files
  const visibleFiles = files.filter(file => !shouldHideFile(file));
  
  // Create categories
  const categories = {
    folders: [],
    images: [],
    documents: [],
    executables: [],
    archives: [],
    other: []
  };
  
  // Sort files into categories
  visibleFiles.forEach(file => {
    if (file.isDirectory) {
      categories.folders.push(file);
    } else {
      // Check extension to categorize
      const ext = file.extension.toLowerCase();
      if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) {
        categories.images.push(file);
      } else if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'xlsx', 'csv', 'pptx'].includes(ext)) {
        categories.documents.push(file);
      } else if (['exe', 'msi', 'bat'].includes(ext)) {
        categories.executables.push(file);
      } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        categories.archives.push(file);
      } else {
        categories.other.push(file);
      }
    }
  });
  
  // Sort each category
  for (const category in categories) {
    categories[category].sort((a, b) => a.name.localeCompare(b.name));
  }
  
  return categories;
}