// 该文件应放在项目根目录的api文件夹中
// 用于验证令牌名称并返回实际的GitHub令牌

export default async function handler(req, res) {
    // 只允许POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '只允许POST请求' });
    }

    const { tokenName } = req.body;

    if (!tokenName) {
        return res.status(400).json({ message: '请提供令牌名称' });
    }

    try {
        // 这里应该从环境变量或安全的存储中获取令牌
        // 永远不要在代码中硬编码敏感信息
        
        // 实际应用中，应该有一个令牌名称到实际令牌的映射
        // 并从环境变量中获取这些信息
        const tokenMap = {
            // 这些值应该从环境变量中获取
            // 例如：process.env.TOKEN_NAME_1: process.env.GITHUB_TOKEN_1
            'valid-token-1': process.env.GITHUB_TOKEN_1,
            'valid-token-2': process.env.GITHUB_TOKEN_2
        };

        // 查找对应的GitHub令牌
        const githubToken = tokenMap[tokenName];

        if (!githubToken) {
            return res.status(401).json({ message: '无效的令牌名称' });
        }

        // 返回令牌（仅在验证成功后）
        return res.status(200).json({ token: githubToken });
    } catch (error) {
        console.error('获取令牌失败:', error);
        return res.status(500).json({ message: '服务器错误，无法获取令牌' });
    }
}
