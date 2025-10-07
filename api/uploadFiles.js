// 上传文件到GitHub的云函数
import { getConfig, validateConfig } from './config.js';

// 检查密码是否正确
function checkPassword(password) {
  const config = getConfig();
  return password === config.UPLOAD_PASSWORD;
}

// 获取GitHub目录中的文件列表
async function getGitHubDirectoryFiles(directoryPath, config) {
  const { GITHUB_USERNAME, GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN } = config;
  
  const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${directoryPath}?ref=${GITHUB_BRANCH}`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      // 如果目录不存在（404错误），返回空数组
      if (response.status === 404) {
        return [];
      }
      
      const errorData = await response.json();
      throw new Error(`获取目录文件列表失败: ${errorData.message || response.statusText}`);
    }
    
    const data = await response.json();
    // 过滤出文件（排除目录）并返回文件名列表
    return data
      .filter(item => item.type === 'file')
      .map(item => item.name);
  } catch (error) {
    console.error('获取目录文件列表时出错:', error);
    throw error;
  }
}

// 生成唯一的文件名（如果有重复则添加时间戳）
function generateUniqueFileName(originalFileName, existingFileNames) {
  if (!existingFileNames.includes(originalFileName)) {
    return originalFileName;
  }
  
  // 文件名有重复，在文件名后添加时间戳
  const timestamp = new Date().getTime();
  const fileExtension = getFileExtension(originalFileName);
  const baseName = originalFileName.replace(/\.[^/.]+$/, '');
  
  return `${baseName}_${timestamp}.${fileExtension}`;
}

// 上传单个文件到GitHub，支持进度回调
async function uploadSingleFile(file, config, onProgress) {
  const { GITHUB_USERNAME, GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN, FILE_STORAGE_PATH } = config;
  
  // 读取文件内容并转换为Base64
  const fileContent = await readFileAsBase64(file);
  
  // 获取目录中的文件列表
  const existingFileNames = await getGitHubDirectoryFiles(FILE_STORAGE_PATH, config);
  
  // 生成唯一的文件名（如果有重复则添加时间戳，否则保持原名称）
  const fileName = generateUniqueFileName(file.name, existingFileNames);
  
  // 构建文件路径
  const filePath = `${FILE_STORAGE_PATH}${fileName}`;
  
  // GitHub API URL
  const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`;
  
  // 构建请求体
  const requestBody = {
    message: `Upload file: ${fileName}`,
    content: fileContent,
    branch: GITHUB_BRANCH
  };
  
  // 使用XMLHttpRequest来获取上传进度
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.open('PUT', apiUrl);
    xhr.setRequestHeader('Authorization', `token ${GITHUB_TOKEN}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
    
    // 监听上传进度事件
    if (onProgress && xhr.upload) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          // 限制最大进度为90%，留10%在上传完成时跳变
          const limitedProgress = Math.min(progress, 90);
          onProgress(limitedProgress);
        }
      });
    }
    
    // 监听完成事件
    xhr.onload = function() {
      try {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve({
            success: true,
            fileName: fileName,
            filePath: filePath,
            downloadUrl: data.download_url,
            commitSha: data.sha
          });
        } else {
          const errorData = JSON.parse(xhr.responseText);
          throw new Error(`GitHub API error: ${errorData.message || xhr.statusText}`);
        }
      } catch (error) {
        console.error('上传文件失败:', error);
        resolve({
          success: false,
          fileName: fileName,
          error: error.message
        });
      }
    };
    
    // 监听错误事件
    xhr.onerror = function() {
      const error = new Error('网络错误，上传失败');
      console.error('上传文件失败:', error);
      resolve({
        success: false,
        fileName: fileName,
        error: error.message
      });
    };
    
    // 发送请求
    xhr.send(JSON.stringify(requestBody));
  });
}

// 读取文件并转换为Base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // 移除Data URL前缀
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 获取文件扩展名
function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

// 主函数，处理文件上传
export async function uploadFiles(files, password) {
  try {
    // 验证配置
    if (!validateConfig()) {
      throw new Error('配置不完整，无法上传文件');
    }
    
    // 检查密码
    if (!checkPassword(password)) {
      throw new Error('密码错误，拒绝上传');
    }
    
    const config = getConfig();
    const uploadResults = [];
    
    // 循环上传所有文件
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 在上传前，通过自定义事件发送进度更新（0%）
      if (typeof window !== 'undefined') {
        const progressEvent = new CustomEvent('uploadProgress', {
          detail: {
            index: i,
            progress: 0,
            fileName: file.name,
            status: 'starting'
          }
        });
        window.dispatchEvent(progressEvent);
      }
      
      // 创建进度回调函数
      const progressCallback = (progress) => {
        if (typeof window !== 'undefined') {
          const progressEvent = new CustomEvent('uploadProgress', {
            detail: {
              index: i,
              progress: progress,
              fileName: file.name,
              status: 'uploading'
            }
          });
          window.dispatchEvent(progressEvent);
        }
      };
      
      try {
        const result = await uploadSingleFile(file, config, progressCallback);
        uploadResults.push(result);
        
        // 上传完成后，发送100%进度
        if (typeof window !== 'undefined') {
          const progressEvent = new CustomEvent('uploadProgress', {
            detail: {
              index: i,
              progress: result.success ? 100 : 0,
              fileName: file.name,
              status: result.success ? 'completed' : 'failed'
            }
          });
          window.dispatchEvent(progressEvent);
        }
      } catch (error) {
        console.error('上传过程中出错:', error);
        uploadResults.push({
          success: false,
          fileName: file.name,
          error: error.message
        });
        
        // 上传失败后，发送0%进度
        if (typeof window !== 'undefined') {
          const progressEvent = new CustomEvent('uploadProgress', {
            detail: {
              index: i,
              progress: 0,
              fileName: file.name,
              status: 'failed'
            }
          });
          window.dispatchEvent(progressEvent);
        }
      }
    }
    
    // 过滤成功上传的文件
    const successfulUploads = uploadResults.filter(result => result.success);
    
    return {
      success: successfulUploads.length > 0,
      totalFiles: files.length,
      successfulFiles: successfulUploads.length,
      failedFiles: files.length - successfulUploads.length,
      uploadResults: uploadResults,
      successfulUploads: successfulUploads
    };
  } catch (error) {
    console.error('上传过程发生错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
}