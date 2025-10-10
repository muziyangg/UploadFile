// FileRecordManager类用于管理文件记录
class FileRecordManager {
    constructor() {
        // 使用cacheUploadFile存储文件记录
        this.fileRecords = JSON.parse(sessionStorage.getItem('cacheUploadFile') || '[]');
        this.initUI();
        this.renderFileRecords();
        // 获取客户端信息
        this.clientInfo = window.clientInfo || {};
    }

    // 初始化UI
    initUI() {
        this.fileRecordsListEl = document.getElementById('fileRecordsList');
    }

    // 记录成功上传的文件
    recordSuccessfulUploads(files) {
        const successfulFiles = files.filter(file => file.status === 'success');
        
        if (successfulFiles.length > 0) {
            successfulFiles.forEach(file => {
                this.fileRecords.push({
                    name: file.name,
                    size: file.size,
                    time: file.time || new Date().toLocaleString('zh-CN'),
                    uploader: file.uploader || '未知',
                    uploadAddress: file.uploadAddress || '未知地址',
                    ip: file.ip || '未知IP'
                });
            });

            // 先保存到sessionStorage的cacheUploadFile中
            sessionStorage.setItem('cacheUploadFile', JSON.stringify(this.fileRecords));
            
            // 然后更新UI
            this.renderFileRecords();
        }
    }

    // 渲染文件记录列表
    renderFileRecords() {
        if (!this.fileRecordsListEl) return;
        
        this.fileRecordsListEl.innerHTML = '';
        
        if (this.fileRecords.length === 0) {
            this.fileRecordsListEl.innerHTML = '<p class="text-gray-500 text-sm">暂无上传记录</p>';
            return;
        }

        const fileListEl = document.createElement('ul');
        fileListEl.className = 'space-y-3';
        
        // 按时间倒序排列
        const sortedRecords = [...this.fileRecords].reverse();
        
        sortedRecords.forEach(file => {
            const fileItemEl = document.createElement('li');
            fileItemEl.className = 'p-3 bg-gray-50 rounded-md';
            
            // 创建文件图标和名称容器
            const fileHeaderEl = document.createElement('div');
            fileHeaderEl.className = 'flex items-center mb-2';
            
            const iconEl = document.createElement('i');
            iconEl.className = this.getFileIconClass(file.name, 'success');
            iconEl.style.marginRight = '8px';
            
            const nameContainer = document.createElement('div');
            nameContainer.className = 'relative flex-1';
            
            const nameEl = document.createElement('div');
            nameEl.textContent = file.name;
            nameEl.className = 'text-sm font-medium break-all whitespace-pre-line max-h-[40px] overflow-hidden';
            // 添加文件名浮窗
            nameEl.setAttribute('title', file.name);
            
            nameContainer.appendChild(nameEl);
            fileHeaderEl.appendChild(iconEl);
            fileHeaderEl.appendChild(nameContainer);
            
            // 创建文件信息容器（支持左右滚动）
            const infoContainer = document.createElement('div');
            infoContainer.className = 'file-info-container overflow-x-auto whitespace-nowrap pb-1';
            
            // 文件信息文本 - 包含IP地址
            const infoText = `上传人: ${file.uploader || '未知'} | 上传时间: ${file.time} | 上传地址: ${file.uploadAddress || '未知'} | IP地址: ${file.ip || '未知IP'} | 文件大小: ${this.formatFileSize(file.size)}`;
            const infoEl = document.createElement('div');
            infoEl.textContent = infoText;
            infoEl.className = 'text-xs text-gray-600 inline-block';
            
            infoContainer.appendChild(infoEl);
            
            // 将所有元素添加到文件项中
            fileItemEl.appendChild(fileHeaderEl);
            fileItemEl.appendChild(infoContainer);
            fileListEl.appendChild(fileItemEl);
        });
        
        this.fileRecordsListEl.appendChild(fileListEl);
    }

    // 获取文件图标类名
    getFileIconClass(fileName, status) {
        if (!fileName || typeof fileName !== 'string') {
            return 'fa fa-file-o text-gray-500';
        }
        
        const parts = fileName.split('.');
        if (parts.length <= 1) {
            return 'fa fa-file-o text-gray-500';
        }
        
        const extension = parts.pop().toLowerCase();
        
        const statusClass = status === 'success' ? 'text-green-500' : 
                          status === 'error' ? 'text-red-500' : 
                          status === 'uploading' ? 'text-blue-500' : 'text-gray-500';
        
        switch (extension) {
            case 'doc':
            case 'docx':
                return `fa fa-file-word-o ${statusClass}`;
            case 'pdf':
                return `fa fa-file-pdf-o ${statusClass}`;
            case 'txt':
                return `fa fa-file-text-o ${statusClass}`;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                return `fa fa-file-image-o ${statusClass}`;
            default:
                return `fa fa-file-o ${statusClass}`;
        }
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 创建FileRecordManager实例
    const fileRecordManager = new FileRecordManager();
    
    // 添加到全局window对象，以便app.js可以调用
    window.fileRecordManager = fileRecordManager;
    
    // 等待Vue应用挂载完成后进行集成
    setTimeout(() => {
        try {
            // 获取Vue应用实例
            const appInstance = document.querySelector('#app').__vue_app__;
            if (appInstance) {
                // 获取app的上下文
                const appProxy = appInstance._instance.proxy;
                
                if (appProxy && appProxy.uploadAllFiles) {
                    // 保存原始的uploadAllFiles函数
                    const originalUploadAllFiles = appProxy.uploadAllFiles;
                    
                    // 重写uploadAllFiles函数
                    appProxy.uploadAllFiles = async function() {
                        const result = await originalUploadAllFiles.apply(this, arguments);
                        
                        // 上传完成后记录成功的文件
                        setTimeout(() => {
                            if (appProxy.files && appProxy.files.length > 0) {
                                fileRecordManager.recordSuccessfulUploads(appProxy.files);
                            }
                        }, 100);
                        
                        return result;
                    };
                }
            }
        } catch (error) {
            console.error('集成文件记录功能失败:', error);
        }
    }, 1000);

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        /* 文件列表容器 - 只显示一个垂直滚动条 */
        .file-list {
            //max-height: 400px;
            overflow-y: auto;
            overflow-x: hidden;
        }
        /* 优化垂直滚动条样式 */
        .file-list::-webkit-scrollbar {
            width: 6px;
        }
        .file-list::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }
        .file-list::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 3px;
        }
        .file-list::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
        /* 文件信息容器 - 不再显示水平滚动条，内容自动换行 */
        .file-info-container {
            white-space: normal;
            word-wrap: break-word;
            padding-bottom: 4px;
        }
        /* 文件名样式增强 */
        .file-item .file-name {
            cursor: pointer;
        }
        /* 确保文件项内容完整显示 */
        .file-info-container div {
            display: inline-block;
        }
    `;
    document.head.appendChild(style);
});