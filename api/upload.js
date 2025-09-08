export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, repo, branch, path, content } = req.body;
    
    // 验证必要参数
    if (!username || !repo || !branch || !path || !content) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 验证环境变量中的GitHub令牌
    if (!process.env.GITHUB_TOKEN) {
        return res.status(500).json({ error: '服务器未配置GitHub令牌' });
    }
    
    try {
        // 先尝试获取文件SHA（检查文件是否已存在）
        let sha = null;
        const checkUrl = `https://api.github.com/repos/${username}/${repo}/contents/${path}?ref=${branch}`;
        
        const checkResponse = await fetch(checkUrl, {
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Vercel Cloud Function'
            }
        });
        
        if (checkResponse.status === 200) {
            const fileData = await checkResponse.json();
            sha = fileData.sha;
        } else if (checkResponse.status !== 404) {
            // 除了404（文件不存在）之外的错误
            const errorData = await checkResponse.json();
            throw new Error(`获取文件信息失败: ${errorData.message || checkResponse.statusText}`);
        }
        
        // 上传文件到GitHub
        const uploadUrl = `https://api.github.com/repos/${username}/${repo}/contents/${path}`;
        
        const payload = {
            message: `Upload file: ${path.split('/').pop()}`,
            content: content,
            branch: branch
        };
        
        // 如果文件已存在，添加SHA用于更新
        if (sha) {
            payload.sha = sha;
        }
        
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
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
        
        const result = await uploadResponse.json();
        return res.status(200).json({ success: true, data: result });
        
    } catch (error) {
        console.error('上传过程出错:', error);
        return res.status(500).json({ error: error.message });
    }
}
