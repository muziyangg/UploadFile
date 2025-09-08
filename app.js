// DOM元素获取
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const filesContainer = document.getElementById('filesContainer');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const emptyMessage = document.getElementById('emptyMessage');
const uploadBtn = document.getElementById('uploadBtn');
const statusMessage = document.getElementById('statusMessage');
const githubUsername = document.getElementById('githubUsername');
const githubRepo = document.getElementById('githubRepo');
const githubBranch = document.getElementById('githubBranch');
const filePath = document.getElementById('filePath');

let files = [];

// 加载保存的配置
function loadSettings() {
    const savedUsername = localStorage.getItem('githubUsername');
    if (savedUsername) {
        githubUsername.value = savedUsername;
    }
    
    const savedRepo = localStorage.getItem('githubRepo');
    if (savedRepo) {
        githubRepo.value = savedRepo;
    }
    
    const savedBranch = localStorage.getItem('githubBranch');
    if (savedBranch) {
        githubBranch.value = savedBranch;
    }
    
    const savedFilePath = localStorage.getItem('filePath');
    if (savedFilePath) {
        filePath.value = savedFilePath;
    }
}

function saveSettings() {
    localStorage.setItem('githubUsername', githubUsername.value);
    localStorage.setItem('githubRepo', githubRepo.value);
    localStorage.setItem('githubBranch', githubBranch.value);
    localStorage.setItem('filePath', filePath.value);
}

loadSettings();

// 拖放事件处理
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight() {
    dropArea.classList.add('active');
}

function unhighlight() {
    dropArea.classList.remove('active');
}

dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const newFiles = Array.from(dt.files);
    addFiles(newFiles);
}

// 点击选择文件
dropArea.addEventListener('click', () => {
    if (!dropArea.classList.contains('active')) {
        fileInput.click();
    }
});

fileInput.addEventListener('change', function() {
    const newFiles = Array.from(this.files);
    addFiles(newFiles);
    this.value = ''; // 重置，允许重复选择同一文件
});

// 添加文件到列表
function addFiles(newFiles) {
    if (newFiles.length === 0) return;
    
    // 过滤掉已存在的文件
    const uniqueFiles = newFiles.filter(newFile => 
        !files.some(existingFile => 
            existingFile.name === newFile.name && 
            existingFile.size === newFile.size &&
            existingFile.lastModified === newFile.lastModified
        )
    );
    
    if (uniqueFiles.length === 0) {
        showMessage('所选文件已在列表中', 'info');
        return;
    }
    
    files = [...files, ...uniqueFiles];
    renderFileList();
    uploadBtn.disabled = false;
}

// 渲染文件列表
function renderFileList() {
    if (files.length === 0) {
        fileList.classList.add('hidden');
        emptyMessage.classList.remove('hidden');
        return;
    }
    
    fileList.classList.remove('hidden');
    emptyMessage.classList.add('hidden');
    fileCount.textContent = files.length;
    
    filesContainer.innerHTML = '';
    
    files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item px-4 py-3 flex items-center justify-between';
        fileItem.innerHTML = `
            <div class="flex items-center">
                <i class="fa fa-file-o text-gray-500 mr-3"></i>
                <div>
                    <div class="font-medium text-gray-800 truncate max-w-xs" title="${file.name}">${file.name}</div>
                    <div class="text-sm text-gray-500">${formatFileSize(file.size)}</div>
                    <div class="progress-container">
                        <div class="progress-bar" data-index="${index}"></div>
                    </div>
                </div>
            </div>
            <button class="text-red-500 hover:text-red-700 delete-btn" data-index="${index}">
                <i class="fa fa-trash-o"></i>
            </button>
        `;
        filesContainer.appendChild(fileItem);
    });
    
    // 添加删除事件
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            files.splice(index, 1);
            renderFileList();
            if (files.length === 0) {
                uploadBtn.disabled = true;
            }
        });
    });
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 显示消息
function showMessage(text, type = 'info') {
    statusMessage.textContent = text;
    statusMessage.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'bg-blue-100', 'text-blue-800');
    
    switch(type) {
        case 'success':
            statusMessage.classList.add('bg-green-100', 'text-green-800');
            break;
        case 'error':
            statusMessage.classList.add('bg-red-100', 'text-red-800', 'error-message');
            break;
        default:
            statusMessage.classList.add('bg-blue-100', 'text-blue-800');
    }
    
    // 3秒后自动隐藏消息
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 3000);
}

// 上传按钮点击事件
uploadBtn.addEventListener('click', async () => {
    saveSettings();
    
    const username = githubUsername.value;
    const repo = githubRepo.value;
    const branch = githubBranch.value;
    let path = filePath.value;
    
    // 配置验证
    if (!username || !repo) {
        showMessage('请输入GitHub用户名和仓库名', 'error');
        return;
    }
    if (path && !path.endsWith('/')) path += '/';
    if (files.length === 0) {
        showMessage('没有文件可上传', 'error');
        return;
    }
    
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>上传中...';
    
    try {
        // 收集成功上传的文件
        const successFiles = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                // 通过Vercel云函数上传文件
                await uploadFileViaCloudFunction(file, username, repo, branch, path, i);
                successFiles.push({
                    name: file.name,
                    path: path + file.name
                });
            } catch (error) {
                showMessage(`文件 "${file.name}" 上传失败: ${error.message}`, 'error');
                console.error(`文件 "${file.name}" 上传失败:`, error);
            }
        }
        
        // 所有文件上传完成后，触发工作流
        if (successFiles.length > 0) {
            await triggerWorkflowViaCloudFunction(successFiles, username, repo);
            showMessage(`成功上传 ${successFiles.length}/${files.length} 个文件，已通过file_uploaded更新文档`, 'success');
        }
        
        // 清空文件列表
        files = [];
        renderFileList();
    } catch (error) {
        console.error('上传过程出错:', error);
        showMessage(`上传失败: ${error.message}`, 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa fa-upload mr-2"></i>上传所有文件';
    }
});

// 通过Vercel云函数上传文件
async function uploadFileViaCloudFunction(file, username, repo, branch, path, fileIndex) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const fullFilePath = path + file.name;
        
        reader.onload = async (event) => {
            try {
                updateProgress(fileIndex, 20);
                const base64Content = event.target.result.split(',')[1];
                
                // 调用Vercel云函数
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        repo,
                        branch,
                        path: fullFilePath,
                        content: base64Content
                    })
                });
                
                updateProgress(fileIndex, 60);
                
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.error || `上传失败: ${response.status}`);
                }
                
                updateProgress(fileIndex, 100);
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = (error) => {
            reject(new Error(`文件读取错误: ${error.message}`));
        };
        
        reader.readAsDataURL(file);
    });
}

// 通过Vercel云函数触发工作流
async function triggerWorkflowViaCloudFunction(successFiles, username, repo) {
    const batchTimestamp = new Date().toISOString();
    
    const response = await fetch('/api/trigger-workflow', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            repo,
            batchFiles: successFiles,
            batchTimestamp
        })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
        throw new Error(result.error || `工作流触发失败: ${response.status}`);
    }
    
    return result;
}

// 更新进度条
function updateProgress(fileIndex, percentage) {
    const progressBar = document.querySelector(`.progress-bar[data-index="${fileIndex}"]`);
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
}
