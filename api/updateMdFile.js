// 更新MD文件的云函数
import { getConfig, validateConfig } from '../config.js';

// 获取当前文件的SHA（用于更新文件）
async function getFileSha(filePath, config) {
  const { MD_GITHUB_USERNAME, MD_GITHUB_REPO, MD_GITHUB_BRANCH, MD_GITHUB_TOKEN } = config;
  
  const apiUrl = `https://api.github.com/repos/${MD_GITHUB_USERNAME}/${MD_GITHUB_REPO}/contents/${filePath}?ref=${MD_GITHUB_BRANCH}`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${MD_GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.status === 404) {
      // 文件不存在，返回null
      return null;
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`获取文件SHA失败: ${errorData.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.sha;
  } catch (error) {
    console.error('获取文件SHA时出错:', error);
    throw error;
  }
}

// 初始化文件头
function generateFileHeader() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-');
  
  return `---
title: 上传文件记录
slug: 上传文件记录 37d3dcd9d2
description:
date: ${dateStr}
lastmod: ${timeStr}
image: img/title.jpg
math:
license:
hidden: false
draft: false
password:
categories: ['仪器文档上传']
tags: []
---
`;
}

// 从现有文件中提取内容和元数据
function parseExistingMarkdown(content) {
  // 确保content是字符串
  if (typeof content !== 'string') {
    content = String(content || '');
  }
  
  // 提取文件头
  const headerMatch = content.match(/^---\n([\s\S]*?)---\n/);
  if (!headerMatch) {
    return {
      header: generateFileHeader(),
      tableContent: ''
    };
  }
  
  const header = headerMatch[0];
  const restContent = content.replace(header, '');
  
  // 提取表格内容 - 寻找包含文件名、上传时间和下载链接的表格
  // 支持包含或不包含上传人和上传地址列
  const tableRegex = /\|\s*文件名\s*\|\s*上传时间\s*\|\s*下载链接\s*(\|\s*上传人\s*(\|\s*上传地址\s*)?)?\|/;
  const tableMatch = restContent.match(tableRegex);
  
  let tableContent = '';
  if (tableMatch && tableMatch.index !== -1) {
    // 提取从表格开始到内容结束的所有内容
    tableContent = restContent.substring(tableMatch.index);
  }
  
  return {
    header: header,
    tableContent: tableContent
  };
}

// 更新lastmod参数
function updateLastmodInHeader(header) {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-');
  
  if (header.includes('lastmod:')) {
    return header.replace(/lastmod: .*/, `lastmod: ${timeStr}`);
  } else {
    return header.replace(/---\n$/, `lastmod: ${timeStr}\n---\n`);
  }
}

// 格式化上传文件数据，确保包含所需字段
function formatUploadedFiles(uploadedFiles) {
  return uploadedFiles.map(file => {
    // 处理可能的不同数据结构
    if (typeof file === 'string') {
      // 如果是字符串，假设是文件名
      return {
        fileName: file,
        downloadUrl: ''
      };
    } else if (file.name && !file.fileName) {
      // 如果有name属性但没有fileName属性，转换一下
      return {
        fileName: file.name,
        downloadUrl: file.downloadUrl || file.url || ''
      };
    }
    // 已经有正确的格式
    return {
      fileName: file.fileName || file.name || '未知文件',
      downloadUrl: file.downloadUrl || file.url || ''
    };
  });
}

// 生成新的表格行
function generateTableRows(uploadedFiles, uploaderInfo) {
  const now = new Date();
  const formattedDate = now.toLocaleString('zh-CN');
  
  // 格式化上传的文件数据
  const formattedFiles = formatUploadedFiles(uploadedFiles);
  
  // 获取上传人信息
  const uploaderName = uploaderInfo?.name || '未知上传人';
  const uploaderLocation = uploaderInfo?.location || '未知位置';
  
  let rows = '';
  formattedFiles.forEach(file => {
    const fileName = file.fileName;
    const downloadUrl = file.downloadUrl;
    
    // 如果没有下载链接，显示为文本而不是链接
    const displayLink = downloadUrl ? `[下载](${downloadUrl})` : '暂无链接';
    
    rows += `| ${fileName} | ${formattedDate} | ${displayLink} | ${uploaderName} | ${uploaderLocation} |\n`;
  });
  
  return rows;
}

// 合并现有表格和新的上传文件
function mergeTables(newRows, existingTable) {
  // 如果没有现有表格，创建一个新表格
  if (!existingTable || existingTable.trim() === '') {
    return '| 文件名 | 上传时间 | 下载链接 | 上传人 | 上传地址 |\n|--------|----------|----------|--------|----------|\n' + newRows;
  }
  
  // 处理现有表格内容
  const lines = existingTable.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    // 如果现有表格不完整，创建新表格
    return '| 文件名 | 上传时间 | 下载链接 | 上传人 | 上传地址 |\n|--------|----------|----------|--------|----------|\n' + newRows;
  }
  
  // 提取标题行和分隔行
  let headerLine = lines[0];
  let separatorLine = lines[1];
  
  // 检查现有表格是否包含上传人列和上传地址列
  const hasUploaderColumn = headerLine.includes('上传人');
  const hasLocationColumn = headerLine.includes('上传地址');
  
  // 如果缺少必要的列，更新表头和分隔行
  if (!hasUploaderColumn || !hasLocationColumn) {
    // 新建完整的表头和分隔行
    headerLine = '| 文件名 | 上传时间 | 下载链接 | 上传人 | 上传地址 |';
    separatorLine = '|--------|----------|----------|--------|----------|';
    
    // 对于现有行，添加默认的上传人和上传地址信息
    const updatedExistingRows = lines.slice(2)
      .filter(line => line.trim() && line.includes('|'))
      .map(line => {
        // 假设原有行格式为 | 文件名 | 上传时间 | 下载链接 |
        const parts = line.split('|').filter(part => part.trim() !== '');
        if (parts.length === 3) {
          return `| ${parts[0]} | ${parts[1]} | ${parts[2]} | 未知上传人 | 未知位置 |`;
        }
        return line;
      });
    
    return `${headerLine}\n${separatorLine}\n${newRows}${updatedExistingRows.length > 0 ? updatedExistingRows.join('\n') + '\n' : ''}`;
  }
  
  // 提取现有表格行，跳过标题行和分隔行
  const existingRows = lines.slice(2).filter(line => line.trim() && line.includes('|'));
  
  // 合并新行和现有行，新行放在表头和分隔行之后，现有行之前
  return `${headerLine}\n${separatorLine}\n${newRows}${existingRows.length > 0 ? existingRows.join('\n') + '\n' : ''}`;
}

// 获取文件内容
async function getFileContent(filePath, config) {
  const { MD_GITHUB_USERNAME, MD_GITHUB_REPO, MD_GITHUB_BRANCH, MD_GITHUB_TOKEN } = config;
  
  const apiUrl = `https://api.github.com/repos/${MD_GITHUB_USERNAME}/${MD_GITHUB_REPO}/contents/${filePath}?ref=${MD_GITHUB_BRANCH}`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${MD_GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.status === 404) {
      // 文件不存在，返回null
      return null;
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`获取文件内容失败: ${errorData.message || response.statusText}`);
    }
    
    const data = await response.json();
    // 解码Base64内容并确保正确处理UTF-8编码
    try {
      // 使用更可靠的方式处理UTF-8编码内容
      return decodeURIComponent(escape(atob(data.content)));
    } catch (decodeError) {
      // 如果上述方式失败，尝试直接解码（用于兼容已有文件）
      console.warn('使用UTF-8解码失败，尝试直接解码:', decodeError);
      return atob(data.content);
    }
  } catch (error) {
    console.error('获取文件内容时出错:', error);
    throw error;
  }
}

// 更新或创建Markdown文件
export async function updateMdFile(uploadedFiles, uploaderInfo = {}) {
  try {
    // 参数验证
    if (!Array.isArray(uploadedFiles)) {
      throw new Error('上传文件列表必须是数组格式');
    }
    
    // 验证配置
    if (!validateConfig()) {
      throw new Error('配置不完整，无法更新MD文件');
    }
    
    const config = getConfig();
    const { 
      MD_GITHUB_USERNAME, 
      MD_GITHUB_REPO, 
      MD_GITHUB_BRANCH, 
      MD_GITHUB_TOKEN, 
      MD_FILE_STORAGE_PATH, 
      MD_FILE_STORAGE_NAME 
    } = config;
    
    // 构建完整的文件路径，确保路径格式正确
    const mdFilePath = `${MD_FILE_STORAGE_PATH.endsWith('/') ? MD_FILE_STORAGE_PATH : MD_FILE_STORAGE_PATH + '/'}${MD_FILE_STORAGE_NAME}`;
    
    // 获取当前文件的SHA（如果存在）
    let fileSha = null;
    let existingContent = null;
    
    try {
      fileSha = await getFileSha(mdFilePath, config);
      
      if (fileSha) {
        try {
          // 文件存在，获取现有内容
          existingContent = await getFileContent(mdFilePath, config);
        } catch (contentError) {
          console.warn('获取文件内容失败，使用空文件处理:', contentError);
          // 继续执行，创建新内容
        }
      }
    } catch (shaError) {
      console.warn('获取文件SHA失败，尝试创建新文件:', shaError);
      // 继续执行，尝试创建新文件
    }
    
    let mdContent = '';
    
    if (fileSha && existingContent) {
      try {
        // 解析现有内容
        const { header, tableContent } = parseExistingMarkdown(existingContent);
        
        // 更新lastmod时间
        const updatedHeader = updateLastmodInHeader(header);
        
        // 生成新的表格行，包含上传人信息
        const newRows = generateTableRows(uploadedFiles, uploaderInfo);
        
        // 合并表格
        const mergedTable = mergeTables(newRows, tableContent);
        
        // 组合新的文件内容
        mdContent = updatedHeader + mergedTable;
      } catch (parseError) {
        console.warn('解析现有文件内容失败，使用新文件格式:', parseError);
        // 如果解析失败，使用新文件格式
        const header = generateFileHeader();
        const newRows = generateTableRows(uploadedFiles, uploaderInfo);
        const table = mergeTables(newRows, null);
        mdContent = header + table;
      }
    } else {
      // 文件不存在或获取内容失败，初始化新文件
      const header = generateFileHeader();
      const newRows = generateTableRows(uploadedFiles, uploaderInfo);
      const table = mergeTables(newRows, null);
      mdContent = header + table;
    }
    
    // 转换为Base64（支持UTF-8编码）
    let base64Content = '';
    try {
      // 使用更可靠的方法处理UTF-8编码的内容
      base64Content = btoa(unescape(encodeURIComponent(mdContent)));
    } catch (encodeError) {
      throw new Error(`内容编码失败: ${encodeError.message}`);
    }
    
    // 构建GitHub API请求
    const apiUrl = `https://api.github.com/repos/${MD_GITHUB_USERNAME}/${MD_GITHUB_REPO}/contents/${mdFilePath}`;
    
    // 构建提交消息，包含上传人信息
    const uploaderName = uploaderInfo?.name || '未知上传人';
    const commitMessage = `更新上传文件列表: ${new Date().toLocaleString('zh-CN')} 由 ${uploaderName} 上传`;
    
    const requestBody = {
      message: commitMessage,
      content: base64Content,
      branch: MD_GITHUB_BRANCH
    };
    
    // 如果文件已存在，添加SHA以更新
    if (fileSha) {
      requestBody.sha = fileSha;
    }
    
    // 发送请求到GitHub API
    try {
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${MD_GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GitHub API错误: ${errorData.message || response.statusText || '未知错误'}`);
      }
      
      const data = await response.json().catch(() => ({}));
      
      return {
        success: true,
        mdFilePath: mdFilePath,
        commitSha: data.sha || 'unknown',
        contentUrl: data.content ? data.content.html_url : '',
        message: `成功更新MD文件: ${mdFilePath}`
      };
    } catch (apiError) {
      console.error('GitHub API请求失败:', apiError);
      throw new Error(`更新文件失败: ${apiError.message}`);
    }
  } catch (error) {
    console.error('更新MD文件时出错:', error);
    return {
      success: false,
      error: error.message,
      details: error.stack || ''
    };
  }
}