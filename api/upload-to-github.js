const { exec } = require('child_process');
const path = require('path');

module.exports = async (req, res) => {
    // 只允许POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '方法不允许，仅支持POST请求' });
    }

    const { password, batchFiles, batchTimestamp } = req.body;

    // 验证必要参数
    if (!password || !batchFiles || !batchTimestamp) {
        return res.status(400).json({ error: '缺少必要的参数' });
    }

    // 这里应该添加密码验证逻辑
    // const isValidPassword = await verifyPassword(password);
    // if (!isValidPassword) {
    //     return res.status(403).json({ error: '密码错误，拒绝上传' });
    // }

    try {
        // 将batchFiles转换为JSON字符串
        const batchFilesStr = JSON.stringify(batchFiles);
        
        // 构建Python命令
        const pythonScriptPath = path.join(process.cwd(), 'upload.py');
        const command = `python ${pythonScriptPath} '${batchFilesStr}' '${batchTimestamp}'`;
        
        console.log(`执行命令: ${command}`);
        
        // 执行Python脚本
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`执行错误: ${error.message}`);
                return res.status(500).json({ error: `执行脚本失败: ${error.message}` });
            }
            if (stderr) {
                console.error(`脚本错误输出: ${stderr}`);
                return res.status(500).json({ error: `脚本执行错误: ${stderr}` });
            }
            
            console.log(`脚本输出: ${stdout}`);
            res.status(200).json({ 
                success: true, 
                message: '文件已成功处理并上传到GitHub',
                output: stdout
            });
        });
    } catch (error) {
        console.error('API错误:', error);
        res.status(500).json({ error: `服务器错误: ${error.message}` });
    }
};
