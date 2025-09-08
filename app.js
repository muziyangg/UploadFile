// 固定的GitHub配置信息
const githubConfig = {
    username: "muziyangg",       // 替换为实际用户名
    repo: "Hugo-Upload",         // 替换为实际仓库名
    branch: "main",              // 替换为实际分支名
    filePath: "src/upload/assets/"   // 替换为实际存储路径
};

// 预定义的有效令牌名称的SHA-256哈希值（加盐后）
const validTokenHashes = [
    // 示例：这是"valid-token-1"经过加盐哈希后的结果
    "09970c91dbaee7dc6d8dca4b75a7b524ad594f60744937828456b9315e1a52a0",
    // 可以添加更多有效令牌的哈希值
];

// 盐值 - 应在实际部署时修改为随机字符串并保密
const SALT = "mzy717yhr";  // 替换为实际盐值

// DOM元素获取
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const filesContainer = document.getElementById('filesContainer');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const emptyMessage = document.getElementById('emptyMessage');
const uploadBtn = document.getElementById('uploadBtn');
const statusMessage = document.getElementById('statusMessage');
const tokenName = document.getElementById('tokenName');
const verifyToken = document.getElementById('verifyToken');
const verificationStatus = document.getElementById('verificationStatus');

let files = [];
let isVerified = false;
let githubToken = ""; // 验证通过后获取的实际令牌

// SHA-256 哈希函数（带盐）
async function sha256WithSalt(str) {
    // 将盐值与输入字符串组合
    const saltedStr = SALT + str;
    
    // 编码为UTF-8
    const encoder = new TextEncoder();
    const data = encoder.encode(saltedStr);
    
    // 计算SHA-256哈希
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // 转换为十六进制字符串
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证令牌名称
verifyToken.addEventListener('click', async () => {
    const inputTokenName = tokenName.value.trim();
    
    if (!inputTokenName) {
        showVerificationStatus('请输入令牌名称', 'error');
        return;
    }
    
    try {
        // 计算输入值的加盐哈希
        const inputHash = await sha256WithSalt(inputTokenName);
        
        // 与预定义的有效哈希值比较
        if (validTokenHashes.includes(inputHash)) {
            // 通过Vercel API获取实际的GitHub令牌
            const response = await fetch('/api/get-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tokenName: inputTokenName })
            });
            
            const result = await response.json();
            
            if (response.ok && result.token) {
                githubToken = result.token;
                isVerified = true;
                showVerificationStatus('令牌验证成功，可以上传文件', 'success');
                
                // 如果有文件，启用上传按钮
                if (files.length > 0) {
                    uploadBtn.disabled = false;
                }
            } else {
                throw new Error(result.message || '获取令牌失败');
            }
        } else {
            isVerified = false;
            githubToken = "";
            showVerificationStatus('无效的令牌名称，请重试', 'error');
            uploadBtn.disabled = true;
        }
    } catch (error) {
        console.error('验证过程出错:', error);
        showVerificationStatus('验证过程出错，请重试', 'error');
    }
});

// 显示验证状态
function showVerificationStatus(text, type = 'info') {
    verificationStatus.textContent = text;
    verificationStatus.classList.remove('hidden', 'text-green-600', 'text-red-600', 'text-blue-600');
    
    switch(type) {
        case 'success':
            verificationStatus.classList.add('text-green-600');
            break;
        case 'error':
            verificationStatus.classList.add('text-red-600');
            break;
        default:
            verificationStatus.classList.add('text-blue-600');
    }
}

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
    
    // 如果已验证，启用上传按钮
    if (isVerified) {
        uploadBtn.disabled = false;
    } else {
        showMessage('请先验证令牌才能上传文件', 'info');
    }
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
    // 检查是否已验证
    if (!isVerified || !githubToken) {
        showMessage('请先验证令牌', 'error');
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
                // 上传单个文件，通过Vercel API代理
                await uploadFileViaVercel(file, githubToken, i);
                successFiles.push({
                    name: file.name,
                    path: githubConfig.filePath + file.name
                });
            } catch (error) {
                showMessage(`文件 "${file.name}" 上传失败: ${error.message}`, 'error');
                console.error(`文件 "${file.name}" 上传失败:`, error);
            }
        }
        
        // 所有文件上传完成后，触发工作流更新MD文档
        if (successFiles.length > 0) {
            await triggerBatchWorkflowViaVercel(successFiles, githubToken);
            showMessage(`成功上传 ${successFiles.length}/${files.length} 个文件，已更新文档`, 'success');
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

// 通过Vercel API批量触发工作流
async function triggerBatchWorkflowViaVercel(successFiles, token) {
    const batchTimestamp = new Date().toISOString();
    try {
        const response = await fetch('/api/trigger-workflow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token,
                githubConfig,
                batchFiles: successFiles,
                batchTimestamp
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || `工作流触发失败: ${response.status}`);
        }
        
        console.log(`批量工作流触发成功，共处理 ${successFiles.length} 个文件`);
    } catch (error) {
        console.error('批量工作流触发出错:', error);
        throw error;
    }
}

// 通过Vercel API上传文件到GitHub
async function uploadFileViaVercel(file, token, fileIndex) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const fullFilePath = githubConfig.filePath + file.name;
        
        reader.onload = async (event) => {
            try {
                updateProgress(fileIndex, 20);
                const base64Content = event.target.result.split(',')[1];
                
                // 通过Vercel API上传文件
                const response = await fetch('/api/upload-file', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        token,
                        githubConfig,
                        fileName: file.name,
                        filePath: fullFilePath,
                        content: base64Content
                    })
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.message || `上传失败: ${response.status}`);
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

// 更新进度条
function updateProgress(fileIndex, percentage) {
    const progressBar = document.querySelector(`.progress-bar[data-index="${fileIndex}"]`);
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
}
