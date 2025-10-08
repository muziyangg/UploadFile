const axios = require('axios');

module.exports = async (req, res) => {
  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '只允许POST请求' });
  }

  try {
    // 解析请求体（处理vercel环境中req.body可能已经是对象的情况）
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { files, password, uploader, ipAddress, location } = body;

    // 1. 检查密码
    const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD || '1'; // 默认密码为1
    if (password !== UPLOAD_PASSWORD) {
      return res.status(401).json({ success: false, message: '密码错误，文件不上传' });
    }

    // 2. 验证文件数据
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, message: '没有文件需要上传' });
    }

    // 3. 获取GitHub配置并验证
    const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'muziyangg';
    const GITHUB_REPO = process.env.GITHUB_REPO || 'Hugo-Upload';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
    const FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH || 'src/upload/assets/';
    
    // 验证必要配置
    if (!GITHUB_TOKEN) {
      console.error('错误: GitHub Token未设置');
      return res.status(500).json({ success: false, message: '服务器配置不完整: GitHub Token未设置' });
    }

    // 4. 循环上传文件（优化版本）
    const uploadedFiles = [];
    const failedFiles = [];
    
    // 为了更好地控制上传过程，我们使用串行上传而不是并行上传
    // 这样可以更好地处理错误和资源使用
    for (const file of files) {
      try {
        // 检查文件是否已存在，如果存在则添加时间戳
        let targetFileName = file.name;
        let filePath = FILE_STORAGE_PATH + targetFileName;
        let url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`;
        let fileExists = false;
        
        // 准备请求头
        const headers = {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Vercel Cloud Function' // 添加User-Agent头
        };

        // 检查文件是否已存在
        try {
          console.log(`检查文件 ${file.name} 是否存在...`);
          await axios.get(url, { headers });
          fileExists = true;
          console.log(`文件 ${file.name} 已存在，准备生成新文件名`);
          
          // 生成带时间戳的新文件名
          const timestamp = new Date().getTime();
          const nameParts = file.name.split('.');
          if (nameParts.length > 1) {
            const extension = nameParts.pop();
            targetFileName = `${nameParts.join('.')}_${timestamp}.${extension}`;
          } else {
            targetFileName = `${file.name}_${timestamp}`;
          }
          
          // 使用新文件名构建路径和URL
          filePath = FILE_STORAGE_PATH + targetFileName;
          url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`;
          console.log(`使用新文件名: ${targetFileName}`);
        } catch (error) {
          // 文件不存在，继续上传
          if (error.response && error.response.status !== 404) {
            console.error(`检查文件 ${file.name} 存在性失败:`, error.message);
            if (error.response) {
              console.error('响应状态码:', error.response.status);
              console.error('响应数据:', error.response.data);
            }
            throw error;
          }
          console.log(`文件 ${file.name} 不存在，将创建新文件`);
        }

        // 准备上传数据
        const uploadData = {
          message: `Upload file: ${targetFileName} by ${uploader}${fileExists ? ' (自动重命名，原文件已存在)' : ''}`,
          content: file.content,
          branch: GITHUB_BRANCH
        };

        // 调用GitHub API上传文件
        console.log(`上传文件 ${file.name} 到路径: ${filePath}`);
        const response = await axios.put(url, uploadData, { headers });
        console.log(`文件 ${file.name} 上传成功，SHA: ${response.data.sha}`);

        uploadedFiles.push({
          name: targetFileName,
          originalName: file.name,
          path: filePath,
          size: file.size,
          downloadUrl: response.data.download_url,
          sha: response.data.sha,
          uploader: uploader,
          ipAddress: ipAddress,
          location: location,
          uploadTime: new Date().toISOString()
        });
      } catch (error) {
        console.error(`上传文件 ${targetFileName} 失败:`, error.message);
        let errorMsg = error.message;
        if (error.response) {
          console.error('响应状态码:', error.response.status);
          console.error('响应数据:', error.response.data);
          // 提供更详细的错误信息
          if (error.response.status === 401) {
            errorMsg = 'GitHub Token无效或权限不足';
          } else if (error.response.status === 404) {
            errorMsg = '仓库不存在或路径不正确';
          } else if (error.response.status === 403) {
            errorMsg = '权限被拒绝，请检查Token权限';
          }
        }
        failedFiles.push({
          name: targetFileName,
          originalName: file.name,
          error: errorMsg
        });
      }
    }

    // 5. 检查是否有上传成功的文件
    if (uploadedFiles.length === 0) {
      return res.status(500).json({ 
        success: false, 
        message: '所有文件上传失败',
        failedFiles: failedFiles.map(f => f.name)
      });
    }

    // 6. 调用updateMD.js来更新MD文件
    if (uploadedFiles.length > 0) {
      try {
        // 直接调用updateMD模块中的核心功能函数
        const updateMD = require('./updateMD');
        
        // 直接传递上传文件数据，不需要创建模拟的HTTP请求对象
        const result = await updateMD.updateFileRecords(uploadedFiles);
        
        console.log('MD文件更新内容:', uploadedFiles);

        console.log('MD文件更新结果:', result);
        
      } catch (error) {
        console.error('更新MD文件失败:', error);
        // 即使更新MD文件失败，文件上传仍然视为成功
      }
    }

    // 7. 返回结果
    return res.status(200).json({
      success: true,
      message: `${uploadedFiles.length}个文件上传成功`,
      uploadedFiles: uploadedFiles,
      failedFiles: failedFiles.map(f => f.name)
    });

  } catch (error) {
    console.error('上传过程中发生错误:', error);
    return res.status(500).json({
      success: false,
      message: '上传过程中发生错误',
      error: error.message,
      // 添加更多调试信息
      debugInfo: {
        githubConfigured: !!process.env.GITHUB_TOKEN,
        requestBodyPresent: !!req.body,
        timestamp: new Date().toISOString()
      }
    });
  }
};