const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 生成MD文件内容
function generateMDContent(existingContent, uploadedFiles) {
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  // 提取表格的最后一行数据，如果存在
  const tableRegex = /\|\s*序号\s*\|\s*文件名\s*\|\s*文件大小\s*\|\s*上传时间\s*\|\s*文件类型\s*\|/;
  let existingMeta = '';
  let tableContent = '';
  let lastIndex = 0;

  // 如果现有内容包含表格，提取表格前的内容
  if (existingContent) {
    const tableMatch = existingContent.match(tableRegex);
    if (tableMatch) {
      existingMeta = existingContent.substring(0, tableMatch.index);
      // 查找表格结束位置
      const lines = existingContent.substring(tableMatch.index).split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('|') && lines[i].trim() !== '') {
          tableContent = existingContent.substring(tableMatch.index, tableMatch.index + lines.slice(0, i).join('\n').length);
          break;
        }
      }
      // 如果没有找到表格结束，使用整个表格
      if (tableContent === '') {
        tableContent = existingContent.substring(tableMatch.index);
      }
    } else {
      // 如果没有表格，添加表格标题和表头
      existingMeta = existingContent.trim() + '\n\n';
      tableContent = `| 序号 | 文件名 | 文件大小 | 上传时间 | 文件类型 |\n| ---- | ------ | -------- | -------- | -------- |`;
    }
  } else {
    // 如果是新文件，创建表格标题和表头
    existingMeta = '# 文件上传记录\n\n' +
                   '本文件记录了所有上传的文件信息，包含文件名、大小、上传时间等。\n\n';
    tableContent = `| 序号 | 文件名 | 文件大小 | 上传时间 | 文件类型 |\n| ---- | ------ | -------- | -------- | -------- |`;
  }

  // 提取表格中的数据行，找出最大的序号
  const dataLines = tableContent.match(/\|\s*\d+\s*\|.*?\|/g) || [];
  let maxIndex = 0;
  if (dataLines.length > 0) {
    dataLines.forEach(line => {
      const parts = line.split('|').map(part => part.trim());
      const index = parseInt(parts[1]);
      if (!isNaN(index) && index > maxIndex) {
        maxIndex = index;
      }
    });
  }

  // 为每个上传的文件添加一行
  uploadedFiles.forEach((file, index) => {
    const fileIndex = maxIndex + index + 1;
    const fileName = file.name || '未知文件名';
    const fileSize = formatFileSize(file.size || 0);
    const uploadTime = `${formattedDate} ${formattedTime}`;
    const fileType = file.type || 'unknown';
    
    tableContent += `\n| ${fileIndex} | ${fileName} | ${fileSize} | ${uploadTime} | ${fileType} |`;
  });

  // 记录上传日志
  const logPath = path.join(__dirname, '../../public/upload_logs.json');
  try {
    let logs = [];
    if (fs.existsSync(logPath)) {
      const logData = fs.readFileSync(logPath, 'utf8');
      if (logData.trim()) {
        logs = JSON.parse(logData);
      }
    }

    const newLogs = uploadedFiles.map(file => ({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name || '未知文件名',
      fileSize: file.size || 0,
      fileType: file.type || 'unknown',
      uploadTime: new Date().toISOString(),
      timestamp: Date.now()
    }));

    logs = [...logs, ...newLogs];
    
    // 只保留最近1000条日志
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }

    fs.writeFile(logPath, JSON.stringify(logs, null, 2), (err) => {
      if (err) {
        console.error('写入上传日志失败:', err);
      }
    });
  } catch (error) {
    console.error('记录上传日志时出错:', error);
  }

  return existingMeta + tableContent;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 导出核心功能函数，供直接调用
exports.updateFileRecords = async (uploadedFiles) => {
  try {
    // 验证上传文件数据
    if (!uploadedFiles || !Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
      throw new Error('没有上传的文件数据');
    }

    // 获取GitHub配置并验证
    const MD_GITHUB_USERNAME = process.env.MD_GITHUB_USERNAME || process.env.GITHUB_USERNAME || 'muziyangg';
    const MD_GITHUB_REPO = process.env.MD_GITHUB_REPO || process.env.GITHUB_REPO || 'Hugo-Upload';
    const MD_GITHUB_BRANCH = process.env.MD_GITHUB_BRANCH || process.env.GITHUB_BRANCH || 'main';
    const MD_GITHUB_TOKEN = process.env.MD_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
    const MD_FILE_STORAGE_PATH = process.env.MD_FILE_STORAGE_PATH || 'content/post/';
    const MD_FILE_STORAGE_NAME = process.env.MD_FILE_STORAGE_NAME || '上传文件记录.md';
    
    // 验证必要配置
    if (!MD_GITHUB_TOKEN) {
      console.error('错误: GitHub Token未设置');
      throw new Error('服务器配置不完整: GitHub Token未设置');
    }

    // 构建GitHub API URL
    const filePath = MD_FILE_STORAGE_PATH + MD_FILE_STORAGE_NAME;
    const url = `https://api.github.com/repos/${MD_GITHUB_USERNAME}/${MD_GITHUB_REPO}/contents/${filePath}`;
    
    // 准备请求头
    const headers = {
      'Authorization': `token ${MD_GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Vercel Cloud Function' // 添加User-Agent头
    };

    // 检查文件是否已存在
    let existingContent = '';
    let sha = '';
    try {
      console.log(`检查MD文件 ${MD_FILE_STORAGE_NAME} 是否存在...`);
      const checkResponse = await axios.get(url, { headers });
      existingContent = Buffer.from(checkResponse.data.content, 'base64').toString('utf-8');
      sha = checkResponse.data.sha;
      console.log(`MD文件 ${MD_FILE_STORAGE_NAME} 已存在，使用SHA: ${sha}`);
    } catch (error) {
      // 文件不存在，创建新文件
      if (error.response && error.response.status !== 404) {
        console.error(`检查MD文件存在性失败:`, error.message);
        if (error.response) {
          console.error('响应状态码:', error.response.status);
          console.error('响应数据:', error.response.data);
        }
        throw error;
      }
      console.log(`MD文件 ${MD_FILE_STORAGE_NAME} 不存在，将创建新文件`);
    }

    // 生成新的文件内容
    const newContent = generateMDContent(existingContent, uploadedFiles);

    // 转换为base64
    const base64Content = Buffer.from(newContent, 'utf-8').toString('base64');

    // 准备上传数据
    const uploadData = {
      message: `Update file records: added ${uploadedFiles.length} files`,
      content: base64Content,
      branch: MD_GITHUB_BRANCH
    };

    // 如果文件已存在，添加sha
    if (sha) {
      uploadData.sha = sha;
    }

    // 调用GitHub API上传文件
    console.log(`上传MD文件 ${MD_FILE_STORAGE_NAME} 到路径: ${filePath}`);
    const response = await axios.put(url, uploadData, { headers });
    console.log(`MD文件 ${MD_FILE_STORAGE_NAME} 上传成功，SHA: ${response.data.sha}`);

    return {
      success: true,
      message: 'MD文件更新成功',
      data: response.data
    };

  } catch (error) {
    console.error('更新MD文件失败:', error.message);
    if (error.response) {
      console.error('响应状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
      // 提供更详细的错误信息
      if (error.response.status === 401) {
        throw new Error('GitHub Token无效或权限不足');
      } else if (error.response.status === 404) {
        throw new Error('仓库不存在或路径不正确');
      } else if (error.response.status === 403) {
        throw new Error('权限被拒绝，请检查Token权限');
      }
    }
    throw error;
  }
};

// 保持原有云函数调用方式的兼容性
exports.handler = async (req, res) => {
  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '只允许POST请求' });
  }

  try {
    // 解析请求体
    const body = JSON.parse(req.body);
    const { uploadedFiles } = body;
    
    // 调用核心功能函数
    const result = await exports.updateFileRecords(uploadedFiles);
    
    return res.status(200).json(result);

  } catch (error) {
    console.error('更新MD文件失败:', error.message);
    
    // 从环境变量获取GitHub配置
    const MD_GITHUB_TOKEN = process.env.MD_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
    
    return res.status(500).json({
      success: false,
      message: '更新MD文件失败',
      error: error.message,
      // 添加更多调试信息
      debugInfo: {
        githubConfigured: !!MD_GITHUB_TOKEN,
        requestBodyPresent: !!req.body,
        timestamp: new Date().toISOString()
      }
    });
  }
};

// 确保exports对象上的所有属性都能被访问到
// 先将exports对象赋值给module.exports，再设置handler为默认导出
module.exports = exports;
// 保持向后兼容性，允许直接调用模块作为handler函数
module.exports.default = exports.handler;

// 生成MD文件内容
function generateMDContent(existingContent, uploadedFiles) {
  const now = new Date();
  const nowISO = now.toISOString();
  const nowFormatted = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-');

  // 读取配置文件
  let config = { tabletitle: '| 文件名 | 上传时间 | 文件大小 | 上传人 | 下载链接 |' };
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configData);
    }
  } catch (error) {
    console.error('读取配置文件失败:', error);
  }

  // 根据表头生成表格线
  const tableParts = config.tabletitle.split('|').filter(part => part.trim().length > 0);
  const tableLines = '|' + tableParts.map(() => '------').join('|') + '|';

  let tableContent = '';
  let existingMeta = '';
  let existingTable = '';

  // 处理已存在的内容
  if (existingContent) {
    // 检查是否有元数据
    const metaMatch = existingContent.match(/^---\n([\s\S]*?)\n---/);
    if (metaMatch) {
      // 提取整个元数据块（包括开始和结束的---）
      existingMeta = metaMatch[0];
      // 更新lastmod
      existingMeta = existingMeta.replace(/lastmod: .*/, `lastmod: ${nowFormatted}`);
      // 确保元数据格式正确，---后紧跟元数据，最后是---
      const metaEndIndex = existingMeta.lastIndexOf('---');
      existingMeta = existingMeta.substring(0, metaEndIndex + 3).trim();
      // 获取元数据之后的内容，并移除所有前导空白字符
      existingTable = existingContent.substring(metaMatch[0].length).trimStart();
    } else {
      existingTable = existingContent.trim();
    }
  } else {
    // 生成新的元数据
    const slug = `上传文件记录 ${Math.random().toString(16).slice(2, 10)}`;
    existingMeta = `---\n`;
    existingMeta += `title: 上传文件记录\n`;
    existingMeta += `slug: ${slug}\n`;
    existingMeta += `description: \n`;
    existingMeta += `date: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}\n`;
    existingMeta += `lastmod: ${nowFormatted}\n`;
    existingMeta += `image: img/title.jpg\n`;
    existingMeta += `math: \n`;
    existingMeta += `license: \n`;
    existingMeta += `hidden: false\n`;
    existingMeta += `draft: false\n`;
    existingMeta += `password: \n`;
    existingMeta += `categories: ['仪器文档上传']\n`;
    existingMeta += `tags: []\n`;
    existingMeta += `---`;
  }

  // 按照时间倒序排序文件
  const sortedFiles = [...uploadedFiles].sort((a, b) => 
    new Date(b.uploadTime) - new Date(a.uploadTime)
  );

  // 提取现有表格中的数据行
  const tableRows = existingTable.split('\n')
    .filter(row => row.includes('|') && !row.includes('---') && !row.includes(config.tabletitle))
    .filter(row => row.trim().length > 0);

  // 创建新的数据行
  const newRows = sortedFiles.map(file => {
    const fileDate = new Date(file.uploadTime).toLocaleDateString('zh-CN');
    const fileTime = new Date(file.uploadTime).toLocaleTimeString('zh-CN');
    const fileDateTime = `${fileDate} ${fileTime}`;
    const fileSize = formatFileSize(file.size);
    const downloadLink = `[${file.name}](${file.downloadUrl})`;

    // 根据配置的表头格式生成行
    return `| ${file.name} | ${fileDateTime} | ${fileSize} | ${file.uploader} | ${downloadLink} |`;
  });

  // 合并所有行并去重
  const allRows = [...new Set([...newRows, ...tableRows])];
  // 重新排序所有行（按时间倒序）
  const finalRows = allRows.sort((a, b) => {
    // 提取时间信息进行排序
    const timeA = a.match(/\| (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}|\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \|/)?.[1] || '';
    const timeB = b.match(/\| (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}|\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \|/)?.[1] || '';
    return new Date(timeB) - new Date(timeA);
  });

  // 重建表格内容，确保文档结构清晰且没有多余的换行符
  tableContent = `\n# 上传文件记录\n\n` +
    `这是自动生成的文件上传记录，记录了通过上传工具上传的文件信息。\n\n` +
    `${config.tabletitle}\n` +
    `${tableLines}\n` +
    finalRows.join('\n') + '\n';

  // 异步记录上传日志
  try {
    const logDir = path.join(process.cwd(), 'log');
    const logPath = path.join(logDir, 'uploadlog.json');
    
    // 确保日志目录存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // 读取现有日志或创建新日志
    let logs = [];
    if (fs.existsSync(logPath)) {
      try {
        const logData = fs.readFileSync(logPath, 'utf8');
        logs = JSON.parse(logData);
      } catch (e) {
        logs = [];
      }
    }
    
    // 添加新的日志记录
    logs.push({
      timestamp: nowISO,
      files: uploadedFiles,
      totalFiles: uploadedFiles.length
    });
    
    // 写入日志（异步）
    fs.writeFile(logPath, JSON.stringify(logs, null, 2), (err) => {
      if (err) {
        console.error('写入上传日志失败:', err);
      }
    });
  } catch (error) {
    console.error('记录上传日志时出错:', error);
  }

  return existingMeta + tableContent;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}