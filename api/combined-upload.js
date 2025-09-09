const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');

class FileProcessor {
    constructor() {
        this.mdRepoOwner = process.env.MD_GITHUB_REPO_OWNER || '';
        this.mdRepoName = process.env.MD_GITHUB_REPO_NAME || '';
        this.mdTargetDir = process.env.MD_GITHUB_TARGET_DIR || '';
        this.mdAccessToken = process.env.MD_GITHUB_ACCESS_TOKEN || '';
    }

    async ensureDirectoryExists(filePath) {
        const directory = path.dirname(filePath);
        try {
            await fs.mkdir(directory, { recursive: true });
            console.log(`确保目录存在: ${directory}`);
        } catch (error) {
            console.log(`目录已存在: ${directory}`);
        }
    }

    async updateMdLastmod(mdFilePath) {
        try {
            const content = await fs.readFile(mdFilePath, 'utf8');
            const currentTime = new Date().toISOString().replace('T', ' ').split('.')[0];
            
            let lines = content.split('\n');
            let updated = false;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('lastmod:')) {
                    lines[i] = `lastmod: ${currentTime}`;
                    updated = true;
                    break;
                }
            }

            if (!updated) {
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('date:')) {
                        lines.splice(i + 1, 0, `lastmod: ${currentTime}`);
                        updated = true;
                        break;
                    }
                }
            }

            if (!updated) {
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trim() === '---' && i > 0) {
                        lines.splice(i, 0, `lastmod: ${currentTime}`);
                        updated = true;
                        break;
                    }
                }
            }

            if (updated) {
                await fs.writeFile(mdFilePath, lines.join('\n'));
                console.log(`已更新MD文件的lastmod为: ${currentTime}`);
            } else {
                console.log("未能更新MD文件的lastmod字段");
            }
        } catch (error) {
            console.log(`MD文件不存在，无需更新lastmod: ${mdFilePath}`);
        }
    }

    async loadRecords(uploadRecordsPath) {
        try {
            const stats = await fs.stat(uploadRecordsPath);
            console.log(`加载记录文件: ${uploadRecordsPath} (大小: ${stats.size} bytes)`);
            const content = await fs.readFile(uploadRecordsPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.log(`记录文件不存在，创建新列表: ${uploadRecordsPath}`);
            return [];
        }
    }

    async saveRecords(newRecords, uploadRecordsPath, mdFilePath) {
        let records = await this.loadRecords(uploadRecordsPath);

        const processedRecords = newRecords.map(record => {
            let timestamp = record.timestamp;
            if (timestamp.endsWith('Z')) {
                timestamp = timestamp.replace('Z', '+00:00');
            }

            const date = new Date(timestamp);
            const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

            return {
                filename: record.filename,
                path: record.path,
                timestamp: timestamp,
                formatted_date: formattedDate
            };
        });

        records = processedRecords.concat(records);

        await this.ensureDirectoryExists(uploadRecordsPath);
        await fs.writeFile(uploadRecordsPath, JSON.stringify(records, null, 2));

        try {
            const stats = await fs.stat(uploadRecordsPath);
            console.log(`记录已保存: ${uploadRecordsPath} (新大小: ${stats.size} bytes)`);
        } catch (error) {
            console.log(`警告: 记录文件未创建成功`);
        }

        await this.updateMdLastmod(mdFilePath);
        return processedRecords;
    }

    formatFileLink(filePath) {
        const relativePath = filePath.replace("src/upload/", "");
        const fileName = path.basename(filePath);
        const fileNameWithoutExt = path.parse(fileName).name;
        const encodedPath = encodeURIComponent(relativePath).replace(/%20/g, '+');
        return `[${fileNameWithoutExt}](${encodedPath})`;
    }

    async updateMarkdownFile(newRecords, mdFilePath) {
        await this.ensureDirectoryExists(mdFilePath);

        let content = "";
        try {
            const stats = await fs.stat(mdFilePath);
            console.log(`读取现有MD文件: ${mdFilePath} (大小: ${stats.size} bytes)`);
            content = await fs.readFile(mdFilePath, 'utf8');
        } catch (error) {
            console.log(`MD文件不存在，创建新文件: ${mdFilePath}`);
            content = "# 上传文件记录\n\n";
            content += "以下是所有上传文件的记录，按上传时间倒序排列：\n\n";
            content += "| 文件名 | 上传时间 | 文件链接 | 上传人 |\n";
            content += "|--------|----------|----------|--------|\n";
        }

        if (!content.includes("| 文件名 | 上传时间 | 文件链接 |")) {
            console.log("表格头不存在，添加表格结构");
            content += "\n| 文件名 | 上传时间 | 文件链接 | 上传人 |\n";
            content += "|--------|----------|----------|--------|\n";
        }

        const newRows = newRecords.map(record => {
            const row = `| ${record.filename} | ${record.formatted_date} | ${this.formatFileLink(record.path)} | |`;
            console.log(`添加新记录行: ${row.trim()}`);
            return row;
        });

        let lines = content.split('\n');
        let tableStartIndex = null;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("| 文件名 | 上传时间 | 文件链接 |")) {
                tableStartIndex = i + 2;
                break;
            }
        }

        if (tableStartIndex !== null) {
            lines.splice(tableStartIndex, 0, ...newRows);
            console.log(`插入 ${newRows.length} 条新行到位置: ${tableStartIndex}`);
        } else {
            lines.push(...newRows);
            console.log(`未找到表格头，添加 ${newRows.length} 条新行到文件末尾`);
        }

        const updatedContent = lines.join('\n');
        await fs.writeFile(mdFilePath, updatedContent);

        try {
            const stats = await fs.stat(mdFilePath);
            console.log(`MD文件已更新: ${mdFilePath} (新大小: ${stats.size} bytes)`);
            
            const finalContent = await fs.readFile(mdFilePath, 'utf8');
            let missing = 0;
            newRows.forEach(row => {
                if (!finalContent.includes(row)) {
                    missing++;
                }
            });
            
            if (missing === 0) {
                console.log("所有新记录已成功写入MD文件");
            } else {
                console.log(`警告: 有 ${missing} 条新记录未在MD文件中找到`);
            }
        } catch (error) {
            console.log(`错误: MD文件未创建成功`);
        }
        
        return updatedContent;
    }

    async githubApiRequest(options, data = null) {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(responseData));
                        } catch (e) {
                            resolve(responseData);
                        }
                    } else {
                        reject(new Error(`GitHub API 错误: ${res.statusCode} - ${responseData}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    async uploadMdToGitHub(content, fileName = "upload.md") {
        if (!this.mdRepoOwner || !this.mdRepoName || !this.mdAccessToken) {
            throw new Error(
                "Markdown仓库配置不完整，请设置以下环境变量: " +
                "MD_GITHUB_REPO_OWNER, MD_GITHUB_REPO_NAME, MD_GITHUB_ACCESS_TOKEN"
            );
        }

        try {
            // 构建文件路径
            const targetDir = this.mdTargetDir.replace(/\/$/, '');
            const targetPath = targetDir ? `${targetDir}/${fileName}` : fileName;
            
            console.log(`准备上传Markdown文件到: ${targetPath}`);

            // 检查文件是否已存在
            let sha = null;
            try {
                const options = {
                    hostname: 'api.github.com',
                    path: `/repos/${this.mdRepoOwner}/${this.mdRepoName}/contents/${encodeURIComponent(targetPath)}`,
                    method: 'GET',
                    headers: {
                        'Authorization': `token ${this.mdAccessToken}`,
                        'User-Agent': 'Node.js',
                        'Accept': 'application/vnd.github.v3+json'
                    }
                };

                const fileData = await this.githubApiRequest(options);
                sha = fileData.sha;
                console.log(`Markdown文件已存在，将进行更新: ${targetPath}`);
            } catch (error) {
                if (error.message.includes('404')) {
                    console.log(`Markdown文件不存在，将创建新文件: ${targetPath}`);
                } else {
                    throw error;
                }
            }

            // 上传文件
            const commitMessage = `更新上传记录: ${new Date().toLocaleString('zh-CN')}`;
            
            const uploadOptions = {
                hostname: 'api.github.com',
                path: `/repos/${this.mdRepoOwner}/${this.mdRepoName}/contents/${encodeURIComponent(targetPath)}`,
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.mdAccessToken}`,
                    'User-Agent': 'Node.js',
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                }
            };

            const uploadData = {
                message: commitMessage,
                content: Buffer.from(content).toString('base64'),
                branch: 'main'
            };

            if (sha) {
                uploadData.sha = sha;
            }

            const response = await this.githubApiRequest(uploadOptions, uploadData);
            console.log(`Markdown文件已成功上传到独立仓库: ${response.content.html_url}`);
            return response;

        } catch (error) {
            console.error('Markdown文件上传到独立仓库失败:', error.message);
            throw error;
        }
    }

    async processFiles(batchFiles, batchTimestamp) {
        const MD_FILE_PATH = path.join('/tmp', 'src', 'upload.md');
        const UPLOAD_RECORDS = path.join('/tmp', 'upload_records.json');

        console.log(`开始处理 ${batchFiles.length} 个文件`);
        console.log(`批量处理时间戳: ${batchTimestamp}`);

        const newRecords = batchFiles.map(fileInfo => ({
            filename: fileInfo.name,
            path: fileInfo.path,
            timestamp: batchTimestamp
        }));

        const processedRecords = await this.saveRecords(newRecords, UPLOAD_RECORDS, MD_FILE_PATH);
        const mdContent = await this.updateMarkdownFile(processedRecords, MD_FILE_PATH);
        
        // 上传到Markdown独立仓库
        await this.uploadMdToGitHub(mdContent);

        console.log(`成功更新 ${processedRecords.length} 条上传记录并上传到独立仓库`);
        return { success: true, processedRecords };
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '方法不允许，仅支持POST请求' });
    }

    const { password, content, batchTimestamp, fileName } = req.body;
    
    // 验证必要参数
    if (!password || !content || !batchTimestamp || !fileName) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 验证环境变量配置
    if (!process.env.GITHUB_TOKEN || !process.env.UPLOAD_PASSWORD || 
        !process.env.GITHUB_USERNAME || !process.env.GITHUB_REPO || 
        !process.env.GITHUB_BRANCH || !process.env.FILE_STORAGE_PATH) {
        return res.status(500).json({ error: '服务器配置不完整' });
    }
    
    // 验证上传密码
    if (password !== process.env.UPLOAD_PASSWORD) {
        return res.status(403).json({ error: '密码错误，拒绝上传' });
    }
    
    try {
        // 1. 上传文件到GitHub
        let sha = null;
        const { GITHUB_USERNAME, GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN, FILE_STORAGE_PATH } = process.env;
        
        let fileStoragePath = FILE_STORAGE_PATH;
        if (fileStoragePath && !fileStoragePath.endsWith('/')) {
            fileStoragePath += '/';
        }
        const fullFilePath = fileStoragePath + fileName;
        
        // 检查文件是否已存在
        const checkUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${fullFilePath}?ref=${GITHUB_BRANCH}`;
        
        const checkResponse = await fetch(checkUrl, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Vercel Cloud Function'
            }
        });
        
        if (checkResponse.status === 200) {
            const fileData = await checkResponse.json();
            sha = fileData.sha;
        } else if (checkResponse.status !== 404) {
            const errorData = await checkResponse.json();
            throw new Error(`获取文件信息失败: ${errorData.message || checkResponse.statusText}`);
        }
        
        // 上传文件
        const uploadUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${fullFilePath}`;
        
        const payload = {
            message: `Upload file: ${fileName}`,
            content: content,
            branch: GITHUB_BRANCH
        };
        
        if (sha) {
            payload.sha = sha;
        }
        
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Vercel Cloud Function'
            },
            body: JSON.stringify(payload)
        });
        
        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`文件上传失败: ${errorData.message || uploadResponse.statusText}`);
        }
        
        // 2. 使用内置的FileProcessor处理文件记录
        const fileInfo = [{
            name: fileName,
            path: fullFilePath
        }];
        
        const fileProcessor = new FileProcessor();
        const processResult = await fileProcessor.processFiles(fileInfo, batchTimestamp);
        
        console.log('处理结果:', processResult);
        res.status(200).json({ 
            success: true, 
            message: '文件已成功上传到GitHub并处理',
            output: processResult
        });

    } catch (error) {
        console.error('处理过程出错:', error);
        return res.status(500).json({ error: error.message });
    }
};