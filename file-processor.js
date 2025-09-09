const fs = require('fs').promises;
const path = require('path');
const { Octokit } = require('@octokit/rest');

// 配置目标文件和目录（本地临时文件）
const MD_FILE_PATH = path.join('/tmp', 'src', 'upload.md');
const UPLOAD_RECORDS = path.join('/tmp', 'upload_records.json');

class FileProcessor {
    constructor() {
        // Markdown仓库配置
        this.mdRepoOwner = process.env.MD_GITHUB_REPO_OWNER || '';
        this.mdRepoName = process.env.MD_GITHUB_REPO_NAME || '';
        this.mdTargetDir = process.env.MD_GITHUB_TARGET_DIR || '';
        this.mdAccessToken = process.env.MD_GITHUB_ACCESS_TOKEN || '';
        
        // 文件仓库配置（与combined-upload.js保持一致）
        this.fileRepoOwner = process.env.GITHUB_USERNAME || '';
        this.fileRepoName = process.env.GITHUB_REPO || '';
        this.fileStoragePath = process.env.FILE_STORAGE_PATH || '';
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

    async updateMdLastmod() {
        try {
            const content = await fs.readFile(MD_FILE_PATH, 'utf8');
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
                await fs.writeFile(MD_FILE_PATH, lines.join('\n'));
                console.log(`已更新MD文件的lastmod为: ${currentTime}`);
            } else {
                console.log("未能更新MD文件的lastmod字段");
            }
        } catch (error) {
            console.log(`MD文件不存在，无需更新lastmod: ${MD_FILE_PATH}`);
        }
    }

    async loadRecords() {
        try {
            const stats = await fs.stat(UPLOAD_RECORDS);
            console.log(`加载记录文件: ${UPLOAD_RECORDS} (大小: ${stats.size} bytes)`);
            const content = await fs.readFile(UPLOAD_RECORDS, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.log(`记录文件不存在，创建新列表: ${UPLOAD_RECORDS}`);
            return [];
        }
    }

    async saveRecords(newRecords) {
        let records = await this.loadRecords();

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

        await this.ensureDirectoryExists(UPLOAD_RECORDS);
        await fs.writeFile(UPLOAD_RECORDS, JSON.stringify(records, null, 2));

        try {
            const stats = await fs.stat(UPLOAD_RECORDS);
            console.log(`记录已保存: ${UPLOAD_RECORDS} (新大小: ${stats.size} bytes)`);
        } catch (error) {
            console.log(`警告: 记录文件未创建成功`);
        }

        await this.updateMdLastmod();
        return processedRecords;
    }

    formatFileLink(filePath) {
        const relativePath = filePath.replace("src/upload/", "");
        const fileName = path.basename(filePath);
        const fileNameWithoutExt = path.parse(fileName).name;
        const encodedPath = encodeURIComponent(relativePath).replace(/%20/g, ' ');
        return `[${fileNameWithoutExt}](${encodedPath})`;
    }

    async updateMarkdownFile(newRecords) {
        await this.ensureDirectoryExists(MD_FILE_PATH);

        let content = "";
        try {
            const stats = await fs.stat(MD_FILE_PATH);
            console.log(`读取现有MD文件: ${MD_FILE_PATH} (大小: ${stats.size} bytes)`);
            content = await fs.readFile(MD_FILE_PATH, 'utf8');
        } catch (error) {
            console.log(`MD文件不存在，创建新文件: ${MD_FILE_PATH}`);
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
        await fs.writeFile(MD_FILE_PATH, updatedContent);

        try {
            const stats = await fs.stat(MD_FILE_PATH);
            console.log(`MD文件已更新: ${MD_FILE_PATH} (新大小: ${stats.size} bytes)`);
            
            // 验证所有记录都已写入
            const finalContent = await fs.readFile(MD_FILE_PATH, 'utf8');
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

    async uploadMdToGitHub(content, fileName = "upload.md") {
        if (!this.mdRepoOwner || !this.mdRepoName || !this.mdAccessToken) {
            throw new Error(
                "Markdown仓库配置不完整，请设置以下环境变量: " +
                "MD_GITHUB_REPO_OWNER, MD_GITHUB_REPO_NAME, MD_GITHUB_ACCESS_TOKEN"
            );
        }

        try {
            const octokit = new Octokit({ auth: this.mdAccessToken });
            
            // 构建文件路径
            const targetDir = this.mdTargetDir.replace(/\/$/, '');
            const targetPath = targetDir ? `${targetDir}/${fileName}` : fileName;
            
            console.log(`准备上传Markdown文件到: ${targetPath}`);

            // 检查文件是否已存在
            let sha = null;
            try {
                const { data: fileData } = await octokit.repos.getContent({
                    owner: this.mdRepoOwner,
                    repo: this.mdRepoName,
                    path: targetPath
                });
                sha = fileData.sha;
                console.log(`Markdown文件已存在，将进行更新: ${targetPath}`);
            } catch (error) {
                if (error.status === 404) {
                    console.log(`Markdown文件不存在，将创建新文件: ${targetPath}`);
                } else {
                    throw error;
                }
            }

            // 上传文件
            const commitMessage = `更新上传记录: ${new Date().toLocaleString('zh-CN')}`;
            
            const { data: response } = await octokit.repos.createOrUpdateFileContents({
                owner: this.mdRepoOwner,
                repo: this.mdRepoName,
                path: targetPath,
                message: commitMessage,
                content: Buffer.from(content).toString('base64'),
                sha: sha
            });

            console.log(`Markdown文件已成功上传到独立仓库: ${response.content.html_url}`);
            return response;

        } catch (error) {
            console.error('Markdown文件上传到独立仓库失败:', error.message);
            throw error;
        }
    }

    async processFiles(batchFiles, batchTimestamp) {
        console.log(`开始处理 ${batchFiles.length} 个文件`);
        console.log(`批量处理时间戳: ${batchTimestamp}`);

        const newRecords = batchFiles.map(fileInfo => ({
            filename: fileInfo.name,
            path: fileInfo.path,
            timestamp: batchTimestamp
        }));

        const processedRecords = await this.saveRecords(newRecords);
        const mdContent = await this.updateMarkdownFile(processedRecords);
        
        // 上传到Markdown独立仓库
        await this.uploadMdToGitHub(mdContent);

        console.log(`成功更新 ${processedRecords.length} 条上传记录并上传到独立仓库`);
        return { success: true, processedRecords };
    }
}

module.exports = FileProcessor;