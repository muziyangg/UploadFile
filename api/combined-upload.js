const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// 确保上传目录存在
const ensureUploadDir = async () => {
    const uploadDir = path.join(process.cwd(), 'src', 'upload', 'assets');
    try {
        await fs.access(uploadDir);
    } catch {
        await fs.mkdir(uploadDir, { recursive: true });
    }
    return uploadDir;
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '方法不允许，仅支持POST请求' });
    }

    const { password, content, batchTimestamp, fileName } = req.body;

    // 验证必要参数
    if (!password || !content || !batchTimestamp || !fileName) {
        return res.status(400).json({ error: '缺少必要的参数' });
    }

    try {
        // 1. 验证密码 (这里应该添加实际的密码验证逻辑)
        // const isValid = await verifyPassword(password);
        // if (!isValid) {
        //     return res.status(403).json({ error: '密码错误，拒绝上传' });
        // }

        // 2. 确保上传目录存在
        const uploadDir = await ensureUploadDir();
        
        // 3. 保存文件
        const filePath = path.join(uploadDir, fileName);
        const buffer = Buffer.from(content, 'base64');
        await fs.writeFile(filePath, buffer);
        
        console.log(`文件已保存: ${filePath}`);

        // 4. 准备调用Python脚本的参数
        const fileInfo = [{
            name: fileName,
            path: `src/upload/assets/${fileName}`
        }];
        
        const batchFilesStr = JSON.stringify(fileInfo);
        const pythonScriptPath = path.join(process.cwd(), 'upload.py');
        
        // 5. 执行Python脚本
        exec(
            `python ${pythonScriptPath} '${batchFilesStr}' '${batchTimestamp}'`,
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`执行错误: ${error.message}`);
                    // 确保返回JSON格式的错误
                    return res.status(500).json({ 
                        error: `执行脚本失败: ${error.message}`,
                        details: stderr  // 可选：附加详细错误信息
                    });
                }
                if (stderr) {
                    console.error(`脚本错误输出: ${stderr}`);
                    // 确保返回JSON格式的错误
                    return res.status(500).json({ 
                        error: `脚本执行错误`,
                        details: stderr.trim()  // 修剪多余空格，确保JSON格式
                    });
                }
                
                console.log(`脚本输出: ${stdout}`);
                res.status(200).json({ 
                    success: true, 
                    message: '文件已成功上传并处理',
                    output: stdout
                });
            }
        );

    } catch (error) {
        console.error('API错误:', error);
        res.status(500).json({ error: `服务器错误: ${error.message}` });
    }
};
    