const { exec } = require('child_process');
const path = require('path');  // 保留path模块的引用

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
        
        // 关键修复：将变量名从path改为fileStoragePath，避免与path模块冲突
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
        
        // 2. 上传成功后调用Python脚本
        const fileInfo = [{
            name: fileName,
            path: fullFilePath  // 传递GitHub上的文件路径
        }];
        
        const batchFilesStr = JSON.stringify(fileInfo);
        // 使用path模块的join方法（此时path是正确的模块引用）
        const pythonScriptPath = path.join(process.cwd(), 'upload.py');
        
        // 执行Python脚本
        exec(
            `python ${pythonScriptPath} '${batchFilesStr}' '${batchTimestamp}'`,
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`执行错误: ${error.message}`);
                    return res.status(500).json({ 
                        error: `执行脚本失败: ${error.message}`,
                        details: stderr
                    });
                }
                if (stderr) {
                    console.error(`脚本错误输出: ${stderr}`);
                    return res.status(500).json({ 
                        error: `脚本执行错误`,
                        details: stderr.trim()
                    });
                }
                
                console.log(`脚本输出: ${stdout}`);
                res.status(200).json({ 
                    success: true, 
                    message: '文件已成功上传到GitHub并调用脚本处理',
                    output: stdout
                });
            }
        );

    } catch (error) {
        console.error('处理过程出错:', error);
        return res.status(500).json({ error: error.message });
    }
};
    