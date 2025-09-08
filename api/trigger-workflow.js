export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, repo, batchFiles, batchTimestamp } = req.body;
    
    // 验证必要参数
    if (!username || !repo || !batchFiles || !batchTimestamp) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 验证环境变量中的GitHub令牌
    if (!process.env.GITHUB_TOKEN) {
        return res.status(500).json({ error: '服务器未配置GitHub令牌' });
    }
    
    try {
        // 触发GitHub工作流
        const url = `https://api.github.com/repos/${username}/${repo}/dispatches`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Vercel Cloud Function'
            },
            body: JSON.stringify({
                event_type: 'file_uploaded',
                client_payload: {
                    batch_files: batchFiles,
                    batch_timestamp: batchTimestamp
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`工作流触发失败: ${errorData.message || response.statusText}`);
        }
        
        return res.status(200).json({ success: true, message: '工作流已成功触发' });
        
    } catch (error) {
        console.error('工作流触发过程出错:', error);
        return res.status(500).json({ error: error.message });
    }
}
