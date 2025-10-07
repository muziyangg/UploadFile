// 测试环境变量获取功能
import { getEnvironment, getConfig } from './config.js';

// 测试环境判断
export default async function testEnv(req, res) {
  try {
    const env = getEnvironment();
    const config = getConfig();
    
    // 获取process和process.env的信息
    const processInfo = {
      processExists: typeof process !== 'undefined',
      processEnvExists: typeof process !== 'undefined' && typeof process.env !== 'undefined',
      nodeEnv: typeof process !== 'undefined' && process.env ? process.env.NODE_ENV : 'N/A',
      vercelEnv: typeof process !== 'undefined' && process.env ? process.env.VERCEL : 'N/A',
      nodeVercelEnv: typeof process !== 'undefined' && process.env ? process.env.NODE_VERCEL : 'N/A'
    };
    
    // 记录配置信息（注意：不要在生产环境中打印敏感信息）
    console.log('环境判断结果:', env);
    console.log('Process信息:', processInfo);
    console.log('配置信息摘要:', {
      hasGithubUsername: !!config.GITHUB_USERNAME,
      hasGithubRepo: !!config.GITHUB_REPO,
      hasGithubToken: !!config.GITHUB_TOKEN,
      hasMdGithubUsername: !!config.MD_GITHUB_USERNAME,
      hasMdGithubRepo: !!config.MD_GITHUB_REPO,
      hasMdGithubToken: !!config.MD_GITHUB_TOKEN
    });
    
    // 返回测试结果
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      environment: env,
      processInfo: processInfo,
      configSummary: {
        hasGithubUsername: !!config.GITHUB_USERNAME,
        hasGithubRepo: !!config.GITHUB_REPO,
        hasUploadPassword: !!config.UPLOAD_PASSWORD
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('测试环境变量时出错:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}