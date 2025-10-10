/**
 * 处理Markdown文件相关功能
 */

/**
 * 验证特别密码（当前时间格式：YYYYMMDDHH）
 * @param {string} password - 要验证的密码
 * @returns {boolean} - 是否为有效的时间格式密码
 */
function validateSpecialPassword(password) {
  // 获取当前日期时间，格式为YYYYMMDDHH
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const currentTimePassword = `${year}${month}${day}${hour}`;
  
  // 检查是否匹配当前时间格式的密码
  return password === currentTimePassword;
}

/**
 * 从Markdown文档获取文件信息
 * @returns {Array} - 文件记录数组
 */
async function fetchFileInfoFromMarkdown() {
  try {
    // 从配置文件中获取fileMDList
    let fileMDList = [];
    try {
      const response = await fetch('/app-config.json');
      const config = await response.json();
      if (config.fileMDList && Array.isArray(config.fileMDList)) {
        fileMDList = config.fileMDList;
      }
    } catch (error) {
      console.error('无法加载配置文件:', error);
    }
    
    if (fileMDList.length === 0) {
      console.warn('没有配置Markdown文件地址');
      return [];
    }
    
    // 存储所有文件信息的数组
    const allFileRecords = [];
    
    // 遍历所有Markdown文件地址
    for (const mdUrl of fileMDList) {
      try {
        const response = await fetch(mdUrl, { cache: 'no-store' });
        const mdContent = await response.text();
        
        // 解析Markdown中的表格数据
        const fileRecords = parseFileTableFromMarkdown(mdContent);
        allFileRecords.push(...fileRecords);
      } catch (error) {
        console.error(`获取或解析Markdown文件失败: ${mdUrl}`, error);
      }
    }
    
    // 保存到localStorage
    localStorage.setItem('cachedFileRecords', JSON.stringify({
      data: allFileRecords,
      timestamp: Date.now()
    }));
    
    console.log(`成功获取并缓存了${allFileRecords.length}条文件记录`);
    return allFileRecords;
  } catch (error) {
    console.error('获取文件信息失败:', error);
    return [];
  }
}

/**
 * 从Markdown中解析文件表格
 * @param {string} mdContent - Markdown内容
 * @returns {Array} - 解析出的文件记录数组
 */
function parseFileTableFromMarkdown(mdContent) {
  const fileRecords = [];
  
  // 匹配Markdown表格
  const tableRegex = /\|\s*文件名\s*\|\s*上传时间\s*\|\s*文件大小\s*\|\s*上传人\s*\|\s*上传地址\s*\|\s*下载链接\s*\|\s*\n([\s\S]*?)(\n[^|]|$)/;
  const tableMatch = mdContent.match(tableRegex);
  
  if (!tableMatch) {
    console.warn('未找到文件表格');
    return [];
  }
  
  const tableContent = tableMatch[1];
  // 分割表格行
  const rows = tableContent.trim().split('\n');
  
  // 跳过表头分隔线
  const dataRows = rows.filter(row => !row.startsWith('|--'));
  
  // 解析每一行数据
  for (const row of dataRows) {
    // 分割单元格
    const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
    
    if (cells.length >= 6) {
      // 提取下载链接中的URL
      let downloadUrl = cells[5];
      const urlMatch = cells[5].match(/\]\(([^)]+)\)/);
      if (urlMatch) {
        downloadUrl = urlMatch[1];
      }
      
      fileRecords.push({
        fileName: cells[0],
        uploadTime: cells[1],
        fileSize: cells[2],
        uploader: cells[3],
        uploadAddress: cells[4],
        downloadUrl: downloadUrl
      });
    }
  }
  
  return fileRecords;
}

/**
 * 显示搜索区域和统计iframe
 */
function showSearchAndStatisticsArea() {
  // 显示左侧隐藏的div块
  const searchDiv = document.getElementById('search');
  if (searchDiv) {
    searchDiv.classList.add('visible');
    
    // 更新app区域的宽度，确保只占据中间位置
    const appDiv = document.getElementById('app');
    if (appDiv) {
      appDiv.style.gridColumn = '2';
      appDiv.style.width = '100%';
    }
  }
  
  // 保存原始的右侧内容，以便后续恢复
  const statisticsDiv = document.getElementById('statistics');
  if (statisticsDiv) {
    // 保存原始内容到一个隐藏的div中
    let originalContentDiv = document.getElementById('originalStatisticsContent');
    if (!originalContentDiv) {
      originalContentDiv = document.createElement('div');
      originalContentDiv.id = 'originalStatisticsContent';
      originalContentDiv.style.display = 'none';
      document.body.appendChild(originalContentDiv);
      // 克隆原始内容
      originalContentDiv.innerHTML = statisticsDiv.innerHTML;
    }
    
    // 嵌入statistics.html页面
    const statisticsContainer = document.createElement('div');
    statisticsContainer.id = 'statisticsContainer';
    statisticsContainer.style.height = '100%';
    statisticsContainer.style.width = '100%';
    statisticsContainer.style.background = '#f8fafc';
    
    // 创建头部区域 - 与搜索文件标题样式统一
    const headerDiv = document.createElement('div');
    headerDiv.style.backgroundColor = '#f8fafc';
    headerDiv.style.padding = '10px 15px';
    headerDiv.style.borderBottom = '1px solid #e2e8f0';
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    
    // 添加标题
    const title = document.createElement('h3');
    title.textContent = '文件统计';
    title.style.margin = '0';
    title.style.fontSize = '16px';
    title.style.fontWeight = '500';
    title.style.color = '#1e293b';
    headerDiv.appendChild(title);
    
    // 创建iframe来加载statistics.html
    const iframe = document.createElement('iframe');
    iframe.src = 'statistics.html';
    iframe.style.width = '100%';
    iframe.style.height = 'calc(100%)'; // 减去头部高度
    iframe.style.border = 'none';
    
    // 添加iframe加载完成后的事件
    /*iframe.onload = function() {
      try {
        // 刷新一次数据以确保显示最新内容
        if (iframe.contentWindow && iframe.contentWindow.statisticsModule && iframe.contentWindow.statisticsModule.refreshData) {
          iframe.contentWindow.statisticsModule.refreshData();
        }
      } catch (error) {
        console.warn('刷新统计数据失败:', error);
      }
    };*/
    
    // 将头部添加到容器
    statisticsContainer.appendChild(headerDiv);
    // 将iframe添加到容器
    statisticsContainer.appendChild(iframe);
    
    // 清空并添加新内容
    statisticsDiv.innerHTML = '';
    statisticsDiv.appendChild(statisticsContainer);
    
    // 添加关闭按钮 - 使用与search.html相同的样式
    const closeBtn = document.createElement('button');
    closeBtn.id = 'closeStatisticsBtn';
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '<i class="fa fa-times"></i>';
    closeBtn.style.width = '28px';
    closeBtn.style.height = '28px';
    closeBtn.style.backgroundColor = 'transparent';
    closeBtn.style.background = '#e2e8f0';
    closeBtn.style.color = '#64748b';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.transition = 'background-color 0.2s';
    
    closeBtn.onmouseover = function() {
      closeBtn.style.backgroundColor = '#cbd5e1';
    };
    
    closeBtn.onmouseout = function() {
      closeBtn.style.backgroundColor = '#e2e8f0';
    };
    
    closeBtn.addEventListener('click', function() {
      // 恢复原始内容
      if (statisticsDiv && originalContentDiv) {
        statisticsDiv.innerHTML = originalContentDiv.innerHTML;
        // 重新初始化文件记录列表（如果需要）
        if (window.initFileRecords) {
          window.initFileRecords();
        }
      }
    });
    
    // 将关闭按钮添加到头部区域
    headerDiv.appendChild(closeBtn);
  }
}

// 导出函数供外部使用
window.dealMD = {
  validateSpecialPassword,
  fetchFileInfoFromMarkdown,
  parseFileTableFromMarkdown,
  showSearchAndStatisticsArea
};