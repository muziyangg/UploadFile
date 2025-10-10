/**
 * 文件统计页面功能实现
 */

// 存储所有文件记录
let allFileRecords = [];

// DOM元素
const refreshBtn = document.getElementById('refreshBtn');
const totalFilesElement = document.getElementById('totalFiles');
const totalUploadersElement = document.getElementById('totalUploaders');
const rankListElement = document.getElementById('rankList');
const latestListElement = document.getElementById('latestList');
const noRankDataElement = document.getElementById('noRankData');
const noLatestDataElement = document.getElementById('noLatestData');

// 初始化页面
function initPage() {
    // 加载缓存文件信息
    loadCachedFileRecords();
    
    // 添加刷新按钮事件监听
    refreshBtn.addEventListener('click', handleRefresh);
    
    // 检查是否有关闭按钮，如果有则添加事件监听
    const closeBtn = document.getElementById('statisticsCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeStatisticsPage);
    }
}

// 加载缓存中的文件信息
function loadCachedFileRecords() {
    try {
        const cachedData = localStorage.getItem('cachedFileRecords');
        
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            if (parsedData.data && Array.isArray(parsedData.data)) {
                allFileRecords = parsedData.data;
                
                // 分析数据并展示
                analyzeAndDisplayData();
                return;
            }
        }
        
        // 如果没有缓存数据，显示暂无数据
        showNoDataMessages();
    } catch (error) {
        console.error('加载缓存文件信息失败:', error);
        showNoDataMessages();
        showMessage('加载缓存文件信息失败', 'error');
    }
}

// 分析数据并展示
function analyzeAndDisplayData() {
    if (!allFileRecords || allFileRecords.length === 0) {
        showNoDataMessages();
        return;
    }
    
    // 显示文件总数
    totalFilesElement.textContent = allFileRecords.length;
    
    // 计算上传人数（去重）
    const uniqueUploaders = new Set(allFileRecords.map(record => record.uploader));
    totalUploadersElement.textContent = uniqueUploaders.size;
    
    // 生成上传文档排名前5位
    generateUploaderRanking();
    
    // 生成最新的10个文档列表
    generateLatestDocumentsList();
}

// 生成上传文档排名前5位
function generateUploaderRanking() {
    // 统计每个上传者的文件数量
    const uploaderStats = {};
    
    allFileRecords.forEach(record => {
        const uploader = record.uploader;
        if (uploaderStats[uploader]) {
            uploaderStats[uploader]++;
        } else {
            uploaderStats[uploader] = 1;
        }
    });
    
    // 转换为数组并排序
    const rankingArray = Object.entries(uploaderStats)
        .map(([uploader, count]) => ({ uploader, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // 取前5名
    
    // 清空并填充排名列表
    rankListElement.innerHTML = '';
    
    if (rankingArray.length > 0) {
        noRankDataElement.style.display = 'none';
        
        rankingArray.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'rank-item';
            
            listItem.innerHTML = `
                <div>
                    <span class="rank-number">${index + 1}</span>
                    <span class="file-name">${item.uploader}</span>
                </div>
                <span class="file-info">上传 ${item.count} 个文件</span>
            `;
            
            rankListElement.appendChild(listItem);
        });
    } else {
        noRankDataElement.style.display = 'block';
    }
}

// 生成最新的10个文档列表
function generateLatestDocumentsList() {
    // 按时间倒序排序
    const sortedRecords = [...allFileRecords].sort((a, b) => {
        const timeA = new Date(a.uploadTime);
        const timeB = new Date(b.uploadTime);
        return timeB - timeA; // 倒序排列
    }).slice(0, 10); // 取前10个
    
    // 清空并填充最新文档列表
    latestListElement.innerHTML = '';
    
    if (sortedRecords.length > 0) {
        noLatestDataElement.style.display = 'none';
        
        sortedRecords.forEach(record => {
            const listItem = document.createElement('li');
            listItem.className = 'latest-item';
            // 添加title属性，鼠标悬停时显示完整文档名称
            listItem.title = record.fileName;
            
            // 格式化时间（只保留到分钟）
            const formattedTime = formatDateTime(record.uploadTime);
            
            // 获取上传人
            const uploader = record.uploader || '未知';
            
            listItem.innerHTML = `
                <div class="scroll-container">
                    <div class="file-name-row">${record.fileName}</div>
                    <div class="file-info-row">${uploader}  ${formattedTime}</div>
                </div>
            `;
            
            latestListElement.appendChild(listItem);
        });
    } else {
        noLatestDataElement.style.display = 'block';
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化日期时间
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 处理刷新
async function handleRefresh() {
    // 禁用刷新按钮，显示加载状态
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<div class="loading-spinner"></div> 刷新中...';
    
    try {
        // 首先尝试通过window.parent获取父页面的dealMD对象
        let dealMDObject = window.dealMD;
        
        // 如果当前页面是在iframe中加载的，尝试从父页面获取
        if (!dealMDObject || !dealMDObject.fetchFileInfoFromMarkdown) {
            if (window.parent && window.parent.dealMD) {
                dealMDObject = window.parent.dealMD;
            }
        }
        
        // 调用fetchFileInfoFromMarkdown函数
        if (dealMDObject && dealMDObject.fetchFileInfoFromMarkdown) {
            const newRecords = await dealMDObject.fetchFileInfoFromMarkdown();
            
            if (newRecords && Array.isArray(newRecords)) {
                allFileRecords = newRecords;
                
                // 分析数据并展示
                analyzeAndDisplayData();
                
                // 保存到本地存储
                try {
                    localStorage.setItem('cachedFileRecords', JSON.stringify({ data: allFileRecords }));
                } catch (storageError) {
                    console.warn('无法保存缓存数据:', storageError);
                }
                
                // 显示刷新成功的提示
                showMessage('数据刷新成功', 'success');
            } else {
                console.warn('未获取到新的文件信息');
                showMessage('未获取到新的文件信息', 'error');
            }
        } else {
            console.error('fetchFileInfoFromMarkdown函数不可用');
            showMessage('刷新功能不可用', 'error');
        }
    } catch (error) {
        console.error('刷新文件信息失败:', error);
        showMessage('刷新失败: ' + error.message, 'error');
    } finally {
        // 恢复刷新按钮状态
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fa fa-refresh"></i> 刷新';
    }
}

// 显示暂无数据提示
function showNoDataMessages() {
    totalFilesElement.textContent = '0';
    totalUploadersElement.textContent = '0';
    noRankDataElement.style.display = 'block';
    noLatestDataElement.style.display = 'block';
    rankListElement.innerHTML = '';
    latestListElement.innerHTML = '';
}

// 显示消息提示
function showMessage(message, type) {
    // 移除已存在的消息
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 创建新消息元素
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;
    messageElement.textContent = message;
    
    // 添加到页面
    document.body.appendChild(messageElement);
    
    // 3秒后自动移除
    setTimeout(() => {
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateX(100%)';
        messageElement.style.transition = 'opacity 0.3s, transform 0.3s';
        
        setTimeout(() => {
            messageElement.remove();
        }, 300);
    }, 3000);
}

// 关闭统计页面（在嵌入式视图中使用）
function closeStatisticsPage() {
    // 触发一个自定义事件，让父页面知道需要关闭统计页面
    const closeEvent = new CustomEvent('closeStatistics');
    window.dispatchEvent(closeEvent);
}

// 当页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    // 立即执行初始化，但添加一个小延迟确保DOM完全加载
    setTimeout(initPage, 100);
}

// 添加localStorage事件监听器，实现页面间数据同步
window.addEventListener('storage', function(e) {
    if (e.key === 'cachedFileRecords') {
        console.log('检测到localStorage数据变化，刷新统计页面数据');
        // 重新加载缓存的文件记录
        loadCachedFileRecords();
    }
});

// 暴露一些功能给全局对象，以便在父页面中调用
window.statisticsModule = {
    refreshData: handleRefresh
};