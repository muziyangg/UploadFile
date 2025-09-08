export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
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
        
        // 处理文件路径
        let path = FILE_STORAGE_PATH;
        if (path && !path.endsWith('/')) path += '/';
        const fullFilePath = path + fileName;
        
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
        
        // 2. 触发GitHub工作流
        const workflowUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/dispatches`;
        
        const workflowResponse = await fetch(workflowUrl, {
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Vercel Cloud Function'
            },
            body: JSON.stringify({
                event_type: 'file_uploaded',
                client_payload: {
                    batch_files: [{ name: fileName, path: fullFilePath }],
                    batch_timestamp: batchTimestamp
                }
            })
        });
        
        if (!workflowResponse.ok) {
            const errorData = await workflowResponse.json();
            throw new Error(`工作流触发失败: ${errorData.message || workflowResponse.statusText}`);
        }
        
        return res.status(200).json({ 
            success: true, 
            message: '文件上传成功并触发工作流' 
        });
        
    } catch (error) {
        console.error('处理过程出错:', error);
        return res.status(500).json({ error: error.message });
    }
}
