// 前端主逻辑文件
import { uploadFiles } from './api/uploadFiles.js';
import { updateMdFile } from './api/updateMdFile.js';
import { initConfig } from './api/config.js';

// DOM 元素
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const filesContainer = document.getElementById('filesContainer');
const fileCount = document.getElementById('fileCount');
const uploadBtn = document.getElementById('uploadBtn');
const uploadPassword = document.getElementById('uploadPassword');
const uploader = document.getElementById('uploader');
const statusMessage = document.getElementById('statusMessage');
const emptyMessage = document.getElementById('emptyMessage');

// 存储选择的文件
let selectedFiles = [];

// 初始化事件监听
function initEventListeners() {
  // 文件选择事件
  fileInput.addEventListener('change', handleFileSelect);
  
  // 拖放事件
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  
  dropArea.addEventListener('drop', handleDrop, false);
  
  // 上传按钮点击事件
  uploadBtn.addEventListener('click', handleUpload);
  
  // 密码输入事件，启用/禁用上传按钮
  uploadPassword.addEventListener('input', updateUploadButtonState);
  
  // 上传人输入事件，启用/禁用上传按钮
  uploader.addEventListener('input', updateUploadButtonState);
  
  // 监听上传进度事件
  window.addEventListener('uploadProgress', handleUploadProgress);
}

// 处理上传进度事件
function handleUploadProgress(event) {
  const { index, progress, fileName, status } = event.detail;
  
  // 更新进度条
  updateFileProgress(index, progress);
  
  // 根据状态显示相应的状态消息
  if (status === 'starting') {
    // 开始上传时不需要显示消息，进度条已经显示状态
  } else if (status === 'uploading') {
    // 上传中也不需要额外消息
  } else if (status === 'completed') {
    // 可以选择不显示单个文件的完成消息，只在全部完成后显示
  } else if (status === 'failed') {
    // 可以根据需要显示单个文件的失败消息
  }
}

// 阻止默认拖放行为
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// 高亮拖放区域
function highlight() {
  dropArea.classList.add('active');
}

// 取消高亮拖放区域
function unhighlight() {
  dropArea.classList.remove('active');
}

// 处理文件选择
function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  addFiles(files);
  // 重置input，以便再次选择相同的文件
  fileInput.value = '';
}

// 处理拖放文件
function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = Array.from(dt.files);
  addFiles(files);
}

// 添加文件到列表
function addFiles(files) {
  if (files.length === 0) return;
  
  // 添加新文件到数组
  selectedFiles = [...selectedFiles, ...files];
  
  // 更新UI
  updateFileList();
  updateUploadButtonState();
}

// 更新文件列表UI
function updateFileList() {
  if (selectedFiles.length === 0) {
    fileList.classList.add('hidden');
    emptyMessage.classList.remove('hidden');
    return;
  }
  
  fileList.classList.remove('hidden');
  emptyMessage.classList.add('hidden');
  fileCount.textContent = selectedFiles.length;
  
  // 清空容器并重新添加所有文件
  filesContainer.innerHTML = '';
  
  selectedFiles.forEach((file, index) => {
    const fileItem = createFileItem(file, index);
    filesContainer.appendChild(fileItem);
  });
}

// 创建文件项元素
function createFileItem(file, index) {
  const fileSize = formatFileSize(file.size);
  const fileType = getFileType(file.name);
  
  const fileItem = document.createElement('div');
  fileItem.className = 'file-item px-4 py-3 flex flex-col items-stretch';
  fileItem.dataset.index = index;
  
  fileItem.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <i class="fa ${getFileIcon(fileType)} text-${getFileTypeColor(fileType)} mr-3"></i>
        <div>
          <div class="text-gray-800 font-medium truncate max-w-xs">${file.name}</div>
          <div class="text-sm text-gray-500">${fileSize}</div>
        </div>
      </div>
      <button class="text-red-500 hover:text-red-700 transition remove-file-btn" data-index="${index}">
        <i class="fa fa-trash-o"></i>
      </button>
    </div>
    <div class="progress-container mt-2">
      <div class="progress-bar" data-index="${index}"></div>
    </div>
  `;
  
  // 添加删除按钮事件
  const removeBtn = fileItem.querySelector('.remove-file-btn');
  removeBtn.addEventListener('click', function() {
    const idx = parseInt(this.getAttribute('data-index'));
    removeFile(idx);
  });
  
  return fileItem;
}

// 更新文件上传进度
function updateFileProgress(index, progress) {
  const progressBar = document.querySelector(`.progress-bar[data-index="${index}"]`);
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
    
    // 根据进度设置不同的颜色
    if (progress === 100) {
      progressBar.style.backgroundColor = '#4CAF50'; // 绿色表示完成
    } else if (progress > 0) {
      progressBar.style.backgroundColor = '#2196F3'; // 蓝色表示进行中
    } else {
      progressBar.style.backgroundColor = '#ccc'; // 灰色表示未开始
    }
  }
}

// 重置所有文件进度条
function resetAllProgressBars() {
  const progressBars = document.querySelectorAll('.progress-bar');
  progressBars.forEach(bar => {
    bar.style.width = '0%';
    bar.style.backgroundColor = '#ccc';
  });
}

// 移除文件
function removeFile(index) {
  selectedFiles.splice(index, 1);
  updateFileList();
  updateUploadButtonState();
}

// 更新上传按钮状态
function updateUploadButtonState() {
  const hasFiles = selectedFiles.length > 0;
  const hasPassword = uploadPassword.value.trim() !== '';
  const hasUploader = uploader.value.trim() !== '';
  
  uploadBtn.disabled = !(hasFiles && hasPassword && hasUploader);
}

// 获取用户IP地址和地理位置信息
async function getUserLocation() {
  try {
    // 使用免费的IP查询API获取地理位置信息
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    const ip = data.ip;
    
    // 尝试获取更详细的地理位置信息
    try {
      const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
      const geoData = await geoResponse.json();
      
      // 提取省份和城市信息
      const region = geoData.region || '';
      const city = geoData.city || '';
      
      return {
        ip: ip,
        location: region && city ? `${region} ${city}` : '未知位置'
      };
    } catch (geoError) {
      // 如果地理位置查询失败，至少返回IP地址
      console.warn('获取地理位置信息失败:', geoError);
      return {
        ip: ip,
        location: '未知位置'
      };
    }
  } catch (error) {
    console.error('获取IP地址失败:', error);
    return {
      ip: '未知IP',
      location: '未知位置'
    };
  }
}

// 处理文件上传
async function handleUpload() {
  if (selectedFiles.length === 0) {
    showStatusMessage('请先选择文件', 'error');
    return;
  }
  
  const password = uploadPassword.value.trim();
  if (!password) {
    showStatusMessage('请输入上传密码', 'error');
    return;
  }
  
  const uploaderName = uploader.value.trim();
  if (!uploaderName) {
    showStatusMessage('请输入上传人姓名', 'error');
    return;
  }
  
  // 禁用上传按钮
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>上传中...';
  
  try {
    showStatusMessage('开始上传文件...', 'info');
    
    // 重置所有进度条
    resetAllProgressBars();
    
    // 获取用户地理位置信息
    const userLocation = await getUserLocation();
    
    // 调用上传文件云函数
    const uploadResult = await uploadFiles(selectedFiles, password);
    
    if (uploadResult.success && uploadResult.successfulUploads.length > 0) {
      // 标记所有成功上传的文件进度为100%
      uploadResult.uploadResults.forEach((result, index) => {
        if (result.success) {
          updateFileProgress(index, 100);
        }
      });
      
      // 上传成功，更新MD文件，包含上传人信息和位置
      const uploaderInfo = {
        name: uploaderName,
        location: userLocation.location,
        ip: userLocation.ip
      };
      const mdUpdateResult = await updateMdFile(uploadResult.successfulUploads, uploaderInfo);
      
      if (mdUpdateResult.success) {
        showStatusMessage(
          `成功上传 ${uploadResult.successfulFiles} 个文件，已更新文件列表`,
          'success'
        );
        
        // 清空文件列表
        selectedFiles = [];
        updateFileList();
        updateUploadButtonState();
      } else {
        showStatusMessage(
          `文件上传成功，但更新文件列表失败: ${mdUpdateResult.error}`,
          'warning'
        );
      }
    } else {
      const errorMessage = uploadResult.error || '文件上传失败';
      showStatusMessage(errorMessage, 'error');
    }
  } catch (error) {
    console.error('上传过程发生错误:', error);
    showStatusMessage(`上传失败: ${error.message || '未知错误'}`, 'error');
  } finally {
    // 恢复上传按钮
    uploadBtn.disabled = selectedFiles.length === 0 || !uploadPassword.value.trim();
    uploadBtn.innerHTML = '<i class="fa fa-upload mr-2"></i>上传所有文件';
  }
}

// 显示状态消息
function showStatusMessage(message, type) {
  // 创建包含关闭按钮的HTML
  statusMessage.innerHTML = `
    <div class="flex items-center justify-between">
      <span>${message}</span>
      <button class="status-close-btn text-gray-500 hover:text-gray-800 focus:outline-none">
        <i class="fa fa-times"></i>
      </button>
    </div>
  `;
  
  // 移除所有类型的类
  statusMessage.classList.remove('hidden', 'bg-green-100', 'text-green-800', 
                            'bg-red-100', 'text-red-800', 'bg-blue-100', 'text-blue-800',
                            'bg-yellow-100', 'text-yellow-800');
  
  // 添加对应类型的类
  statusMessage.classList.remove('hidden');
  
  switch (type) {
    case 'success':
      statusMessage.classList.add('bg-green-100', 'text-green-800');
      // 成功消息3秒后自动隐藏
      setTimeout(() => {
        statusMessage.classList.add('hidden');
      }, 3000);
      break;
    case 'error':
      statusMessage.classList.add('bg-red-100', 'text-red-800');
      statusMessage.classList.add('error-message');
      setTimeout(() => {
        statusMessage.classList.remove('error-message');
      }, 500);
      break;
    case 'warning':
      statusMessage.classList.add('bg-yellow-100', 'text-yellow-800');
      break;
    case 'info':
    default:
      statusMessage.classList.add('bg-blue-100', 'text-blue-800');
      break;
  }
  
  // 添加关闭按钮事件
  const closeBtn = statusMessage.querySelector('.status-close-btn');
  closeBtn.addEventListener('click', () => {
    statusMessage.classList.add('hidden');
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

// 获取文件类型
function getFileType(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'bmp'];
  const docTypes = ['doc', 'docx', 'pdf', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'];
  const audioTypes = ['mp3', 'wav', 'ogg'];
  const videoTypes = ['mp4', 'avi', 'mov', 'wmv'];
  const codeTypes = ['js', 'html', 'css', 'json', 'md', 'xml'];
  
  if (imageTypes.includes(extension)) return 'image';
  if (docTypes.includes(extension)) return 'document';
  if (audioTypes.includes(extension)) return 'audio';
  if (videoTypes.includes(extension)) return 'video';
  if (codeTypes.includes(extension)) return 'code';
  
  return 'file';
}

// 获取文件图标
function getFileIcon(fileType) {
  const icons = {
    image: 'fa-file-image-o',
    document: 'fa-file-text-o',
    audio: 'fa-file-audio-o',
    video: 'fa-file-video-o',
    code: 'fa-file-code-o',
    file: 'fa-file-o'
  };
  
  return icons[fileType] || 'fa-file-o';
}

// 获取文件类型对应的颜色
function getFileTypeColor(fileType) {
  const colors = {
    image: 'green-500',
    document: 'blue-500',
    audio: 'purple-500',
    video: 'red-500',
    code: 'yellow-500',
    file: 'gray-500'
  };
  
  return colors[fileType] || 'gray-500';
}

// 初始化应用
async function initApp() {
  try {
    // 直接初始化其他组件，不预先加载配置
    initEventListeners();
    updateFileList();
    updateUploadButtonState();
    
    console.log('应用初始化成功');
  } catch (error) {
    console.error('应用初始化失败:', error);
    showStatusMessage('应用初始化失败', 'error');
  }
}

// 启动应用
initApp();