import { createApp, ref, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

createApp({
  setup() {
    // 响应式数据
    const files = ref([]);
    const uploadPassword = ref('');
    const uploader = ref('');
    const isUploading = ref(false);
    const statusMessage = ref('');
    const statusType = ref(''); // success, error, info
    // 直接设置默认的允许文件类型列表
    const allowedFileTypes = ref(['.docx', '.doc', '.pdf', '.txt', '.jpg', '.jpeg', '.png', '.gif']);
    
    // 加载配置文件（可选）
    const loadConfig = async () => {
      try {
        // 尝试从配置文件加载
        const response = await fetch('/app-config.json');
        const config = await response.json();
        if (config.allowedFileTypes && Array.isArray(config.allowedFileTypes)) {
          allowedFileTypes.value = config.allowedFileTypes;
        }
      } catch (error) {
        console.log('使用默认文件类型配置');
        // 已经有默认值，不需要额外设置
      }
    };
    
    // 页面加载时加载配置
    loadConfig();
    
    // 初始化拖放区域
    const initDropArea = () => {
      const dropArea = document.getElementById('dropArea');
      const fileInput = document.getElementById('fileInput');
      const selectFileBtn = document.getElementById('selectFileBtn');

      // 拖放事件处理
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
      });

      function highlight() {
        dropArea.classList.add('active');
      }

      function unhighlight() {
        dropArea.classList.remove('active');
      }

      ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
      });

      // 处理文件放置
      dropArea.addEventListener('drop', handleDrop, false);

      // 文件选择按钮点击
      selectFileBtn.addEventListener('click', () => {
        fileInput.click();
      });

      // 文件选择变化
      fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
      });
    };

    // 阻止默认行为
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // 处理拖放的文件
    const handleDrop = (e) => {
      const dt = e.dataTransfer;
      const filesList = dt.files;
      handleFiles(filesList);
    };

    // 处理选择的文件
    const handleFiles = (filesList) => {
      if (filesList.length === 0) return;

      const invalidFiles = [];
      const validFiles = [];
      
      Array.from(filesList).forEach(file => {
        // 获取文件扩展名（小写）
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        
        // 检查文件类型是否允许
        const isAllowedType = allowedFileTypes.value.some(type => 
          type.toLowerCase() === extension
        );
        
        if (!isAllowedType) {
          invalidFiles.push(file.name);
        } else {
          // 检查文件是否已经在列表中
          const isDuplicate = files.value.some(f => f.name === file.name && f.size === file.size);
          if (!isDuplicate) {
            validFiles.push({
              name: file.name,
              size: file.size,
              type: file.type,
              file: file,
              status: 'waiting' // waiting, uploading, success, error
            });
          }
        }
      });
      
      // 添加有效文件
      if (validFiles.length > 0) {
        files.value.push(...validFiles);
        updateFileList();
        checkUploadButton();
      }
      
      // 显示无效文件提示
      if (invalidFiles.length > 0) {
        const allowedTypesText = allowedFileTypes.value.join('、');
        showMessage(
          `以下文件类型不允许上传: ${invalidFiles.join('、')}。\n允许的文件类型: ${allowedTypesText}`,
          'error'
        );
      }
    };

    // 获取文件扩展名对应的图标类名
    const getFileIconClass = (fileName, status) => {
      // 确保fileName有效
      if (!fileName || typeof fileName !== 'string') {
        return 'fa fa-file-o mr-3 text-gray-500';
      }
      
      // 获取文件扩展名（转换为小写）
      const parts = fileName.split('.');
      // 如果文件名没有扩展名，返回默认图标
      if (parts.length <= 1) {
        return 'fa fa-file-o mr-3 text-gray-500';
      }
      
      const extension = parts.pop().toLowerCase();
      
      // 根据文件状态返回不同颜色
      const statusClass = status === 'success' ? 'text-green-500' : 
                         status === 'error' ? 'text-red-500' : 
                         status === 'uploading' ? 'text-blue-500' : 'text-gray-500';
      
      // 根据文件扩展名返回不同图标
      // 确保每个类名都以fa开头
      switch (extension) {
        // 文档类型
        case 'doc':
        case 'docx':
          return `fa fa-file-word-o mr-3 ${statusClass}`;
        case 'pdf':
          return `fa fa-file-pdf-o mr-3 ${statusClass}`;
        case 'txt':
          return `fa fa-file-text-o mr-3 ${statusClass}`;
        case 'xls':
        case 'xlsx':
          return `fa fa-file-excel-o mr-3 ${statusClass}`;
        case 'ppt':
        case 'pptx':
          return `fa fa-file-powerpoint-o mr-3 ${statusClass}`;
        
        // 图片类型
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'bmp':
        case 'tiff':
          return `fa fa-file-image-o mr-3 ${statusClass}`;
        
        // 音频类型
        case 'mp3':
        case 'wav':
        case 'ogg':
        case 'flac':
          return `fa fa-file-audio-o mr-3 ${statusClass}`;
        
        // 视频类型
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'wmv':
          return `fa fa-file-video-o mr-3 ${statusClass}`;
        
        // 压缩文件
        case 'zip':
        case 'rar':
        case '7z':
        case 'tar':
        case 'gz':
          return `fa fa-file-archive-o mr-3 ${statusClass}`;
        
        // 代码文件
        case 'js':
        case 'html':
        case 'css':
        case 'php':
        case 'py':
        case 'java':
        case 'cpp':
        case 'c':
          return `fa fa-file-code-o mr-3 ${statusClass}`;
        
        // 默认文件类型
        default:
          return `fa fa-file-o mr-3 ${statusClass}`;
      }
    };

    // 更新文件列表显示
    const updateFileList = () => {
      if (files.value.length > 0) {
        fileList.classList.remove('hidden');
        emptyMessage.classList.add('hidden');
        
        // 获取标题元素
        const fileListHeader = document.getElementById('fileListHeader');
        
        // 设置标题内容并移除之前可能存在的清空按钮
        fileListHeader.innerHTML = '<span>待上传文件 (<span id="fileCount">' + files.value.length + '</span>)</span>';
        
        // 创建清空按钮
        const clearBtn = document.createElement('button');
        clearBtn.className = 'ml-auto text-red-500 text-sm flex items-center';
        clearBtn.innerHTML = '<i class="fa fa-trash mr-1"></i>清空全部';
        clearBtn.onclick = clearAllFiles;
        
        // 设置header为flex布局
        fileListHeader.style.display = 'flex';
        fileListHeader.style.alignItems = 'center';
        
        // 将按钮添加到header元素
        fileListHeader.appendChild(clearBtn);
        
        // 清空容器
        filesContainer.innerHTML = '';
        
        // 添加文件项
        files.value.forEach((file, index) => {
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item p-4 mb-3 border rounded-lg';
          
          // 文件信息行
          const fileInfoRow = document.createElement('div');
          fileInfoRow.className = 'flex items-center justify-between';
          
          const fileInfo = document.createElement('div');
          fileInfo.className = 'flex items-center';
          
          // 文件图标 - 使用根据文件类型的图标
          const fileIcon = document.createElement('i');
          fileIcon.className = getFileIconClass(file.name, file.status);
          
          // 文件详情
          const fileDetails = document.createElement('div');
          const fileName = document.createElement('div');
          fileName.className = 'font-medium';
          fileName.textContent = file.name;
          
          const fileSize = document.createElement('div');
          fileSize.className = 'text-sm text-gray-500';
          fileSize.textContent = formatFileSize(file.size);
          
          // 删除按钮
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'text-red-500 hover:text-red-700 ml-3';
          deleteBtn.innerHTML = '<i class="fa fa-trash-o"></i>';
          deleteBtn.onclick = () => removeFile(index);
          
          // 组装
          fileDetails.appendChild(fileName);
          fileDetails.appendChild(fileSize);
          fileInfo.appendChild(fileIcon);
          fileInfo.appendChild(fileDetails);
          fileInfoRow.appendChild(fileInfo);
          fileInfoRow.appendChild(deleteBtn);
          fileItem.appendChild(fileInfoRow);
          
          filesContainer.appendChild(fileItem);
        });
      } else {
        fileList.classList.add('hidden');
        emptyMessage.classList.remove('hidden');
      }
    };

    // 格式化文件大小
    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // 移除文件
    const removeFile = (index) => {
      files.value.splice(index, 1);
      updateFileList();
      checkUploadButton();
    };

    // 检查上传按钮状态
    const checkUploadButton = () => {
      const uploadBtn = document.getElementById('uploadBtn');
      // 同时检查上传密码、文件列表和上传人
      uploadBtn.disabled = files.value.length === 0 || isUploading.value || !uploadPassword.value || !uploader.value;
      
      // 更新按钮文本和图标
      if (isUploading.value) {
        uploadBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>上传中...';
      } else {
        uploadBtn.innerHTML = '<i class="fa fa-upload mr-2"></i>上传所有文件';
      }
    };

    // 显示状态消息
    const showMessage = (message, type = 'info') => {
      const statusMessage = document.getElementById('statusMessage');
      statusMessage.innerHTML = `
        ${message}
        <button class="close-btn absolute top-2 right-2 text-gray-500 hover:text-gray-700">
          <i class="fa fa-times"></i>
        </button>
      `;
      statusMessage.className = `mt-6 p-4 rounded-lg relative ${type === 'success' ? 'bg-green-100 text-green-700' : type === 'error' ? 'bg-red-100 text-red-700 error-message' : 'bg-blue-100 text-blue-700'}`;
      statusMessage.classList.remove('hidden');
      
      // 添加关闭按钮事件
      const closeBtn = statusMessage.querySelector('.close-btn');
      closeBtn.addEventListener('click', () => {
        statusMessage.classList.add('hidden');
        // 上传成功后，关闭提示框时同时关闭待上传文件框
        if (type === 'success') {
          files.value = [];
          updateFileList();
          checkUploadButton(); // 更新上传按钮状态
        }
      });
      
      // 只让成功消息自动关闭
      if (type === 'success') {
        setTimeout(() => {
          statusMessage.classList.add('hidden');
          // 上传成功自动关闭时，也同时关闭待上传文件框
          files.value = [];
          updateFileList();
          checkUploadButton(); // 更新上传按钮状态
        }, 3000);
      }
    };

    // 清空所有文件
    const clearAllFiles = () => {
      // 清空文件数组
      files.value = [];
      // 更新文件列表显示（会自动隐藏文件列表）
      updateFileList();
      // 更新上传按钮状态
      checkUploadButton();
      // 显示成功消息
      showMessage('所有文件已清空', 'success');
    };

    // 上传所有文件
    const uploadAllFiles = async () => {
      if (!uploadPassword.value) {
        showMessage('请输入上传密码', 'error');
        return;
      }

      if (!uploader.value) {
        showMessage('请输入上传人姓名', 'error');
        return;
      }

      isUploading.value = true;
      checkUploadButton();
      showMessage('正在准备上传文件...', 'info');

      try {
          // 准备文件数据
          const filesData = await Promise.all(
            files.value.map(async (file, index) => {
              // 设置文件初始状态
              file.status = 'uploading';
              updateFileList();
              
              const base64 = await fileToBase64(file.file);
              return {
                name: file.name,
                content: base64,
                size: file.size,
                index: index
              };
            })
          );

          // 调用上传API
          const response = await fetch('/api/uploadfile.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              files: filesData,
              password: uploadPassword.value,
              uploader: uploader.value,
              ipAddress: clientInfo.ip,
              location: clientInfo.location
            })
          });

        console.log('API响应状态码:', response.status);
        
        // 检查响应是否成功
        if (response.status < 200 || response.status >= 300) {
          // 尝试获取错误信息
          let errorText;
          try {
            errorText = await response.text();
            console.error('API错误响应:', errorText);
            showMessage(`上传失败: ${errorText.substring(0, 100)}...`, 'error');
            // 更新所有文件状态为error
            files.value.forEach(file => {
              if (file.status === 'uploading') {
                file.status = 'error';
              }
            });
            updateFileList();
          } catch (e) {
            console.error('无法解析错误响应:', e);
            showMessage(`上传失败: HTTP状态码 ${response.status}`, 'error');
          }
          return;
        }

        // 尝试获取响应结果
        let result;
        try {
          result = await response.json();
          console.log('API响应结果:', result);
          
          if (result.success) {
            // 更新文件状态
            if (result.uploadedFiles && result.uploadedFiles.length > 0) {
              result.uploadedFiles.forEach(uploadedFile => {
                const fileIndex = files.value.findIndex(f => f.name === uploadedFile.name);
                if (fileIndex !== -1) {
                  files.value[fileIndex].status = 'success';
                }
              });
            }
            
            // 处理失败的文件
            if (result.failedFiles && result.failedFiles.length > 0) {
              result.failedFiles.forEach(failedFile => {
                const fileIndex = files.value.findIndex(f => f.name === failedFile);
                if (fileIndex !== -1) {
                  files.value[fileIndex].status = 'error';
                }
              });
            }
            
            updateFileList();
            
            if (result.uploadedFiles && result.uploadedFiles.length > 0) {
              showMessage(`${result.uploadedFiles.length}个文件上传成功！`, 'success');
            }
            
            // 如果所有文件都上传成功，则清空列表
            if (result.uploadedFiles && result.uploadedFiles.length === files.value.length) {
              setTimeout(() => {
                files.value = [];
                updateFileList();
              }, 5000); // 增加等待时间到5秒
            }
          } else {
            showMessage(result.message || '上传失败，请重试', 'error');
          }
        } catch (jsonError) {
          // 如果JSON解析失败，尝试查看响应文本
          try {
            const responseText = await response.text();
            console.error('JSON解析错误，响应文本:', responseText);
            showMessage(`上传失败: 无效的JSON响应 - ${responseText.substring(0, 50)}...`, 'error');
          } catch (e) {
            console.error('JSON解析错误且无法获取响应文本:', e);
            showMessage('上传失败: 无法解析API响应', 'error');
          }
        }
      } catch (error) {
        console.error('上传错误:', error);
        showMessage('上传过程中发生错误，请重试', 'error');
        // 更新所有上传中的文件状态为error
        files.value.forEach(file => {
          if (file.status === 'uploading') {
            file.status = 'error';
          }
        });
        updateFileList();
      } finally {
        isUploading.value = false;
        checkUploadButton();
      }
    };

    // 将文件转换为base64
    const fileToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
      });
    };

    // 生命周期钩子
    onMounted(() => {
      // 初始化拖放区域
      initDropArea();
      
      // 监听输入变化
      document.getElementById('uploadPassword').addEventListener('input', () => {
        uploadPassword.value = document.getElementById('uploadPassword').value;
        checkUploadButton();
      });
      
      // 添加密码可见性切换功能
      document.getElementById('togglePasswordBtn').addEventListener('click', () => {
        const passwordInput = document.getElementById('uploadPassword');
        const passwordIcon = document.getElementById('togglePasswordBtn').querySelector('i');
        
        // 切换密码可见性
        if (passwordInput.type === 'password') {
          passwordInput.type = 'text';
          passwordIcon.classList.remove('fa-eye-slash');
          passwordIcon.classList.add('fa-eye');
        } else {
          passwordInput.type = 'password';
          passwordIcon.classList.remove('fa-eye');
          passwordIcon.classList.add('fa-eye-slash');
        }
      });
      
      document.getElementById('uploader').addEventListener('input', () => {
        uploader.value = document.getElementById('uploader').value;
        checkUploadButton(); // 监听上传人输入变化，更新按钮状态
      });
      
      // 绑定上传按钮点击事件
      document.getElementById('uploadBtn').addEventListener('click', () => {
        uploadAllFiles();
      });
    });

    return {
      files,
      uploadPassword,
      uploader,
      isUploading,
      statusMessage,
      statusType,
      handleFiles,
      removeFile,
      uploadAllFiles,
      checkUploadButton
    };
  }
}).mount('#app');

// 全局变量存储客户端IP和位置信息
let clientInfo = {
  ip: '',
  location: ''
};

// 在页面加载时获取客户端IP和位置
async function getClientInfo() {
  try {
    // 检查缓存中是否有有效的IP信息（12小时内）
    const cachedInfo = localStorage.getItem('cachedClientInfo');
    if (cachedInfo) {
      const { ip, location, timestamp } = JSON.parse(cachedInfo);
      const now = Date.now();
      const twelveHoursInMs = 12 * 60 * 60 * 1000;
      
      // 如果缓存未过期（12小时内），直接使用缓存数据
      if (now - timestamp < twelveHoursInMs) {
        clientInfo.ip = ip;
        clientInfo.location = location;
        console.log('使用缓存的客户端信息');
        return;
      }
    }
    
    // 缓存不存在或已过期，调用API获取新数据
    // 使用ip-api.com API获取IP和中文地理位置信息
    // 注意：ip-api.com限制每分钟查询次数，实际部署时可能需要更换其他API
    const response = await fetch('http://ip-api.com/json/?lang=zh-CN');
    if (response.ok) {
      const data = await response.json();
      
      // 确保获取IPv4地址
      let ipv4Address = data.query || '';
      // 如果是IPv6地址，尝试从本地存储或其他方式获取IPv4地址
      if (ipv4Address.includes(':')) {
        ipv4Address = localStorage.getItem('lastIPv4Address') || 'localhost';
      } else {
        // 保存IPv4地址到本地存储
        localStorage.setItem('lastIPv4Address', ipv4Address);
      }
      
      clientInfo.ip = ipv4Address;
      
      // 格式化位置信息，确保是中文
      if (data.regionName && data.city) {
        clientInfo.location = `${data.regionName} ${data.city}`;
      } else if (data.regionName) {
        clientInfo.location = data.regionName;
      } else if (data.city) {
        clientInfo.location = data.city;
      } else {
        clientInfo.location = data.country || '未知位置';
      }
      
      // 保存到缓存，包含时间戳
      const cacheData = {
        ip: clientInfo.ip,
        location: clientInfo.location,
        timestamp: Date.now()
      };
      localStorage.setItem('cachedClientInfo', JSON.stringify(cacheData));
      console.log('获取并缓存新的客户端信息');
    } else {
      console.warn('获取IP信息失败，使用默认值');
      // 使用默认值
      clientInfo.ip = 'localhost';
      clientInfo.location = '本地环境';
    }
  } catch (error) {
    console.error('获取客户端信息时出错:', error);
    // 错误情况下使用默认值
    clientInfo.ip = 'localhost';
    clientInfo.location = '本地环境';
  }
}

// 页面加载时执行
window.addEventListener('DOMContentLoaded', async () => {
  // 加载客户端信息
  await getClientInfo();
  
  // 其他初始化代码...
});