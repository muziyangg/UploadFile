// 该文件应放在项目根目录的api文件夹中
// 用于代理上传文件到GitHub的请求

export default async function handler(req, res) {
    // 只允许POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '只允许POST请求' });
    }

    const { token, githubConfig, fileName, filePath, content } = req.body;

    // 验证必要的参数
    if (!token || !githubConfig || !fileName || !filePath || !content) {
        return res.status(400).json({ message: '缺少必要的参数' });
    }

    try {
        // 首先获取文件的SHA（如果文件已存在）
        let sha = null;
        const shaResponse = await fetch(
            `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${filePath}?ref=${githubConfig.branch}`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Vercel File Uploader'
                }
            }
        );

        if (shaResponse.status === 200) {
            const data = await shaResponse.json();
            sha = data.sha;
        } else if (shaResponse.status !== 404) {
            // 除了404（文件不存在）之外的错误
            const errorData = await shaResponse.json();
            throw new Error(`获取文件信息失败: ${errorData.message || shaResponse.status}`);
        }

        // 构建上传请求的payload
        const payload = {
            message: `Upload file: ${fileName}`,
            content: content,
            branch: githubConfig.branch
        };
        if (sha) {
            payload.sha = sha;
        }

        // 上传文件到GitHub
        const uploadResponse = await fetch(
            `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Vercel File Uploader'
                },
                body: JSON.stringify(payload)
            }
        );

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`文件上传失败: ${errorData.message || uploadResponse.status}`);
        }

        const result = await uploadResponse.json();
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('文件上传过程出错:', error);
        return res.status(500).json({ message: error.message });
    }
}
