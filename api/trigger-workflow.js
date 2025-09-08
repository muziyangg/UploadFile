// 该文件应放在项目根目录的api文件夹中
// 用于代理触发GitHub工作流的请求

export default async function handler(req, res) {
    // 只允许POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '只允许POST请求' });
    }

    const { token, githubConfig, batchFiles, batchTimestamp } = req.body;

    // 验证必要的参数
    if (!token || !githubConfig || !batchFiles || !batchTimestamp) {
        return res.status(400).json({ message: '缺少必要的参数' });
    }

    try {
        // 触发GitHub工作流
        const response = await fetch(
            `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Vercel File Uploader'
                },
                body: JSON.stringify({
                    event_type: 'file_uploaded',
                    client_payload: {
                        batch_files: batchFiles,
                        batch_timestamp: batchTimestamp
                    }
                })
            }
        );

        if (!response.ok) {
            const errorRes = await response.json();
            throw new Error(`工作流触发失败: ${response.status} - ${errorRes.message}`);
        }

        return res.status(200).json({ success: true, message: '工作流已成功触发' });
    } catch (error) {
        console.error('工作流触发过程出错:', error);
        return res.status(500).json({ message: error.message });
    }
}
