// DOM元素获取
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const filesContainer = document.getElementById('filesContainer');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const emptyMessage = document.getElementById('emptyMessage');
const uploadBtn = document.getElementById('uploadBtn');
const statusMessage = document.getElementById('statusMessage');
const uploadPassword = document.getElementById('uploadPassword');

let files = [];
// 存储上次尝试的密码
let lastAttemptedPassword = null;

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
    const password = uploadPassword.value;
    
    // 验证
    if (!password) {
        showMessage('请输入上传密码', 'error');
        return;
    }
    if (files.length === 0) {
        showMessage('没有文件可上传', 'error');
        return;
    }
    
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>上传中...';
    
    try {
        if (files.length === 1) {
            // 单个文件上传，使用合并的云函数
            await uploadSingleFile(files[0], password);
            showMessage(`成功上传 1 个文件，已更新文档`, 'success');
        } else {
            // 多个文件上传逻辑
            const successFiles = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    const filePath = await uploadFileViaCloudFunction(file, password, i);
                    successFiles.push({
                        name: file.name,
                        path: filePath
                    });
                } catch (error) {
                    // 处理多个文件上传时的密码错误
                    handleUploadError(error, file.name, i);
                    // 如果是密码错误，停止后续文件上传
                    if (error.message.includes('密码错误，拒绝上传')) {
                        break;
                    }
                }
            }
            
            if (successFiles.length > 0) {
                // 调用新的API将文件上传到GitHub
                await uploadToGitHub(successFiles, password);
                showMessage(`成功上传 ${successFiles.length}/${files.length} 个文件，已更新文档并上传到GitHub`, 'success');
            }
        }
        
        // 清空文件列表
        files = [];
        renderFileList();
    } catch (error) {
        console.error('上传过程出错:', error);
        // 处理错误信息显示
        handleUploadError(error);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa fa-upload mr-2"></i>上传所有文件';
    }
});

async function uploadSingleFile(file, password) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                updateProgress(0, 20);
                const base64Content = event.target.result.split(',')[1];
                const batchTimestamp = new Date().toISOString();
                
                // 调用新的合并API，同时处理文件上传和Python脚本调用
                const response = await fetch('/api/combined-upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        password,
                        content: base64Content,
                        batchTimestamp,
                        fileName: file.name
                    })
                });
                
                // 获取结果
                const result = await response.json();
                
                if (!response.ok) {
                    // 重置进度条
                    updateProgress(0, 0);
                    
                    // 存储当前尝试的密码用于下次比较
                    const currentPassword = password;
                    
                    // 抛出包含错误信息的异常
                    const error = new Error(result.error || `上传失败: ${response.status}`);
                    error.password = currentPassword;
                    throw error;
                }
                
                updateProgress(0, 100);
                // 成功后重置上次尝试密码
                lastAttemptedPassword = null;
                resolve();
            } catch (error) {
                updateProgress(0, 0);
                reject(error);
            }
        };
        
        reader.onerror = (error) => {
            updateProgress(0, 0);
            reject(new Error(`文件读取错误: ${error.message}`));
        };
        
        reader.readAsDataURL(file);
    });
}
    

// 多个文件上传 - 通过云函数上传单个文件
async function uploadFileViaCloudFunction(file, password, fileIndex) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                updateProgress(fileIndex, 20);
                const base64Content = event.target.result.split(',')[1];
                
                // 调用上传云函数
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        password,
                        content: base64Content,
                        fileName: file.name
                    })
                });
                
                updateProgress(fileIndex, 60);
                
                const result = await response.json();
                
                if (!response.ok) {
                    // 重置进度条
                    updateProgress(fileIndex, 0);
                    
                    // 存储当前尝试的密码用于下次比较
                    const currentPassword = password;
                    
                    // 抛出包含错误信息的异常
                    const error = new Error(result.error || `上传失败: ${response.status}`);
                    error.password = currentPassword;
                    throw error;
                }
                
                updateProgress(fileIndex, 80);
                resolve(result.data.path); // 返回完整文件路径
            } catch (error) {
                updateProgress(fileIndex, 0);
                reject(error);
            }
        };
        
        reader.onerror = (error) => {
            updateProgress(fileIndex, 0);
            reject(new Error(`文件读取错误: ${error.message}`));
        };
        
        reader.readAsDataURL(file);
    });
}

// 新函数：上传到GitHub
async function uploadToGitHub(successFiles, password, batchTimestamp = null) {
    const timestamp = batchTimestamp || new Date().toISOString();
    
    const response = await fetch('/api/upload-to-github', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            password,
            batchFiles: successFiles,
            batchTimestamp: timestamp
        })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
        // 抛出包含错误信息的异常
        const error = new Error(result.error || `上传到GitHub失败: ${response.status}`);
        error.password = password;
        throw error;
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

// 专门的错误处理函数
function handleUploadError(error, fileName = null, fileIndex = 0) {
    // 检查是否是密码错误
    if (error.message.includes('密码错误，拒绝上传')) {
        const currentPassword = error.password || uploadPassword.value;
        
        // 检查密码是否有变化
        if (lastAttemptedPassword === currentPassword) {
            // 密码未变化，提示用户修改密码
            showMessage('密码错误，请修改密码后重试', 'error');
        } else {
            // 密码有变化，仅提示错误
            const msg = fileName ? 
                `文件 "${fileName}" 上传失败: ${error.message}` : 
                error.message;
            showMessage(msg, 'error');
        }
        
        // 更新上次尝试的密码
        lastAttemptedPassword = currentPassword;
        
        // 重置进度条
        if (fileName) {
            updateProgress(fileIndex, 0);
        } else {
            files.forEach((_, index) => updateProgress(index, 0));
        }
    } else if (error.message.includes('上传到GitHub失败')) {
        // GitHub上传错误
        showMessage(`同步到GitHub失败: ${error.message}`, 'error');
    } else {
        // 其他错误
        const msg = fileName ? 
            `文件 "${fileName}" 上传失败: ${error.message}` : 
            error.message;
        showMessage(msg, 'error');
        
        if (fileName) {
            updateProgress(fileIndex, 0);
        }
    }
}
