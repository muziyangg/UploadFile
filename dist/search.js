// 文件记录数组
let allFileRecords = [];
let filteredRecords = [];
let currentPage = 1;
const itemsPerPage = 10;

// 使用fetch和blob方式下载文件
function downloadFileWithFetch(url, fileName) {
    // 如果URL不是以http或https开头，添加相对路径前缀
    let downloadUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        downloadUrl = './' + url;
    }
    
    fetch(downloadUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应错误');
            }
            return response.blob();
        })
        .then(blob => {
            // 创建临时URL
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // 设置文件名
            a.download = fileName;
            
            // 添加到DOM并触发点击
            document.body.appendChild(a);
            a.click();
            
            // 清理
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(error => {
            console.error('下载文件失败:', error);
            
            // 如果自定义下载方式失败，尝试使用原始链接（可能会在新标签页打开）
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
}

// DOM元素
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const fileList = document.getElementById('fileList');
const fileListContainer = document.getElementById('fileListContainer');
const noFilesMessage = document.getElementById('noFilesMessage');
const pagination = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');

// 可能不存在的元素，需要在HTML更新后才能获取
let pageJumpInput;
let pageJumpBtn;

// 初始化页面
function initPage() {
    // 加载缓存文件信息
    loadCachedFileRecords();
    
    // 添加事件监听器
    searchInput.addEventListener('input', handleSearch);
    refreshBtn.addEventListener('click', handleRefresh);
    prevPageBtn.addEventListener('click', goToPrevPage);
    nextPageBtn.addEventListener('click', goToNextPage);
    
    // 尝试获取页码输入相关元素并添加事件监听
    setupPageJump();
    
    // 再次更新分页控件，确保页码显示正确
    if (filteredRecords.length > 0) {
        const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
        updatePagination(totalPages);
    }
}

// 设置页码跳转功能
function setupPageJump() {
    pageJumpInput = document.getElementById('pageJumpInput');
    pageJumpBtn = document.getElementById('pageJumpBtn');
    
    if (pageJumpInput && pageJumpBtn) {
        // 输入框回车事件
        pageJumpInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handlePageJump();
            }
        });
        
        // 跳转按钮点击事件
        pageJumpBtn.addEventListener('click', handlePageJump);
        
        // 监听上下箭头键事件，实现页码切换
        pageJumpInput.addEventListener('keydown', function(e) {
            const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
            
            if (e.key === 'ArrowUp') {
                e.preventDefault(); // 阻止默认行为
                if (currentPage > 1) {
                    pageJumpInput.value = currentPage - 1;
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault(); // 阻止默认行为
                if (currentPage < totalPages) {
                    pageJumpInput.value = currentPage + 1;
                }
            }
        });
    }
}

// 处理页码跳转
function handlePageJump() {
    if (!pageJumpInput) return;
    
    let targetPage = parseInt(pageJumpInput.value.trim());
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    
    if (isNaN(targetPage) || targetPage < 1) {
        // 页码小于1，跳转到第一页
        targetPage = 1;
    } else if (targetPage > totalPages) {
        // 页码大于总页数，跳转到最后一页
        targetPage = totalPages;
    }
    
    // 更新当前页码并渲染列表
    currentPage = targetPage;
    renderFileList();
    
    // 清空输入框
    pageJumpInput.value = '';
}

// 加载缓存中的文件信息
function loadCachedFileRecords() {
    try {
        const cachedData = localStorage.getItem('cachedFileRecords');
        
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            if (parsedData.data && Array.isArray(parsedData.data)) {
                allFileRecords = parsedData.data;
                
                // 按时间倒序排序
                sortFileRecordsByTime();
                
                // 初始化过滤后的记录
                filteredRecords = [...allFileRecords];
                
                // 显示文件列表
                if (typeof renderFileList === 'function') {
                    renderFileList();
                }
                return;
            }
        }
        
        // 如果没有缓存数据，显示暂无文件消息
        if (typeof showNoFilesMessage === 'function') {
            showNoFilesMessage();
        }
    } catch (error) {
        console.error('加载缓存文件信息失败:', error);
        if (typeof showNoFilesMessage === 'function') {
            showNoFilesMessage();
        }
    }
}

// 按时间倒序排序文件记录
function sortFileRecordsByTime() {
    allFileRecords.sort((a, b) => {
        // 将时间字符串转换为Date对象进行比较
        const timeA = new Date(a.uploadTime);
        const timeB = new Date(b.uploadTime);
        // 倒序排列（最新的在前）
        return timeB - timeA;
    });
}

// 处理搜索
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        // 如果搜索框为空，显示所有文件
        filteredRecords = [...allFileRecords];
    } else {
        // 否则过滤文件
        filteredRecords = allFileRecords.filter(record => 
            record.fileName.toLowerCase().includes(searchTerm) ||
            record.uploader.toLowerCase().includes(searchTerm) ||
            record.uploadAddress.toLowerCase().includes(searchTerm)
        );
    }
    
    // 重置到第一页
    currentPage = 1;
    
    // 重新渲染文件列表
    renderFileList();
}

// 处理刷新
async function handleRefresh() {
    // 禁用刷新按钮，显示加载状态
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 刷新中...';
    
    try {
        // 调用dealMD中的fetchFileInfoFromMarkdown函数
        if (window.dealMD && window.dealMD.fetchFileInfoFromMarkdown) {
            const newRecords = await window.dealMD.fetchFileInfoFromMarkdown();
            
            if (newRecords && Array.isArray(newRecords)) {
                allFileRecords = newRecords;
                
                // 按时间倒序排序
                sortFileRecordsByTime();
                
                // 重新应用搜索过滤
                handleSearch();
                
                // 显示刷新成功的提示
                showRefreshSuccessMessage();
            } else {
                console.warn('未获取到新的文件信息');
            }
        } else {
            console.error('dealMD.fetchFileInfoFromMarkdown函数不可用');
        }
    } catch (error) {
        console.error('刷新文件信息失败:', error);
        showRefreshErrorMessage();
    } finally {
        // 恢复刷新按钮状态
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fa fa-refresh"></i> 刷新';
    }
}

// 显示刷新成功提示
function showRefreshSuccessMessage() {
    // 创建临时提示元素
    const message = document.createElement('div');
    message.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
    message.textContent = '文件信息刷新成功';
    document.body.appendChild(message);
    
    // 3秒后移除提示
    setTimeout(() => {
        message.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => message.remove(), 500);
    }, 3000);
}

// 显示刷新失败提示
function showRefreshErrorMessage() {
    // 创建临时提示元素
    const message = document.createElement('div');
    message.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50';
    message.textContent = '文件信息刷新失败';
    document.body.appendChild(message);
    
    // 3秒后移除提示
    setTimeout(() => {
        message.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => message.remove(), 500);
    }, 3000);
}

// 渲染文件列表
function renderFileList() {
    // 清空文件列表
    fileList.innerHTML = '';
    
    if (filteredRecords.length === 0) {
        showNoFilesMessage();
        return;
    }
    
    // 显示文件列表，隐藏无文件消息
    fileList.style.display = 'block';
    noFilesMessage.style.display = 'none';
    
    // 计算总页数
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    
    // 确保当前页在有效范围内
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }
    
    // 计算当前页显示的文件范围
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredRecords.length);
    const currentPageRecords = filteredRecords.slice(startIndex, endIndex);
    
    // 创建文件项并添加到列表
    currentPageRecords.forEach(record => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        // 文件名称
        const fileNameElement = document.createElement('div');
        fileNameElement.className = 'file-name';
        fileNameElement.textContent = record.fileName;
        
        // 文件详细信息
        const fileDetailElement = document.createElement('div');
        fileDetailElement.className = 'file-detail';
        fileDetailElement.innerHTML = `
            <div>上传时间: ${record.uploadTime}</div>
            <div>文件大小: ${record.fileSize}</div>
            <div>上传人: ${record.uploader}</div>
            <div>上传地址: ${record.uploadAddress}</div>
            ${record.downloadUrl ? `<div>下载链接: <a href="${record.downloadUrl}" download class="text-blue-500 hover:underline">点击下载</a></div>` : ''}
        `;
        
        // 为下载链接添加点击事件，如果直接下载失败则尝试使用fetch和blob方式下载
        if (record.downloadUrl) {
            const downloadLink = fileDetailElement.querySelector('a');
            if (downloadLink) {
                downloadLink.addEventListener('click', function(e) {
                    // 尝试使用自定义下载方式
                    e.preventDefault();
                    downloadFileWithFetch(record.downloadUrl, record.fileName);
                });
            }
        }
        
        // 添加到文件项
        fileItem.appendChild(fileNameElement);
        fileItem.appendChild(fileDetailElement);
        
        // 添加到文件列表
        fileList.appendChild(fileItem);
    });
    
    // 更新分页控件
    updatePagination(totalPages);
}

// 更新分页控件
function updatePagination(totalPages) {
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    
    // 更新页码输入框的placeholder显示当前页数和总页数
    if (pageJumpInput) {
        pageJumpInput.placeholder = `${currentPage}/${totalPages}`;
    }
    
    // 更新上一页按钮状态
    prevPageBtn.disabled = currentPage === 1;
    
    // 更新下一页按钮状态
    nextPageBtn.disabled = currentPage === totalPages;
}

// 显示无文件消息
function showNoFilesMessage() {
    fileList.style.display = 'none';
    pagination.style.display = 'none';
    noFilesMessage.style.display = 'block';
}

// 前往上一页
function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderFileList();
        // 滚动到底部
        scrollToBottom();
    }
}

// 前往下一页
function goToNextPage() {
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderFileList();
        // 滚动到底部
        scrollToBottom();
    }
}

// 滚动到底部
function scrollToBottom() {
    if (fileListContainer) {
        // 增加延迟时间，确保DOM完全更新后再滚动
        setTimeout(() => {
            fileListContainer.scrollTop = fileListContainer.scrollHeight;
        }, 100); // 增加到100ms，确保DOM已完全更新
    }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initPage);

// 添加localStorage事件监听器，实现页面间数据同步
window.addEventListener('storage', function(e) {
    if (e.key === 'cachedFileRecords') {
        console.log('检测到localStorage数据变化，刷新搜索页面数据');
        // 重新加载缓存的文件记录
        loadCachedFileRecords();
    }
});