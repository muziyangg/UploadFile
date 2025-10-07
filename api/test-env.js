// 测试环境变量获取功能
import { getEnvironment, getConfig, initConfig } from './config.js';

// 测试环境判断
export default async function testEnv(req, res) {
  try {
    // 安全地获取环境类型
    let env = 'unknown';
    try {
      env = getEnvironment();
    } catch (error) {
      console.error('获取环境类型时出错:', error);
    }
    
    // 同时测试同步和异步配置获取
    let configSync, configAsync;
    try {
      configSync = getConfig();
    } catch (error) {
      console.error('获取同步配置时出错:', error);
      configSync = { error: error.message };
    }
    
    try {
      configAsync = await initConfig();
    } catch (error) {
      console.error('获取异步配置时出错:', error);
      configAsync = { error: error.message };
    }
    
    // 安全地获取process和process.env的信息
    const processInfo = {
      processExists: false,
      processEnvExists: false,
      nodeEnv: 'N/A',
      vercelEnv: 'N/A',
      nodeVercelEnv: 'N/A',
      hasProcessError: false,
      errorMessage: ''
    };
    
    try {
      processInfo.processExists = typeof process !== 'undefined';
      if (processInfo.processExists) {
        processInfo.processEnvExists = typeof process.env !== 'undefined';
        if (processInfo.processEnvExists) {
          processInfo.nodeEnv = process.env.NODE_ENV || 'N/A';
          processInfo.vercelEnv = process.env.VERCEL || 'N/A';
          processInfo.nodeVercelEnv = process.env.NODE_VERCEL || 'N/A';
        }
      }
    } catch (error) {
      console.error('获取process信息时出错:', error);
      processInfo.hasProcessError = true;
      processInfo.errorMessage = error.message;
    }
    
    // 记录配置信息（注意：不要在生产环境中打印敏感信息）
    console.log('环境判断结果:', env);
    console.log('Process信息:', processInfo);
    
    // 返回测试结果
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      environment: env,
      processInfo: processInfo,
      configSyncSummary: {
        hasGithubUsername: typeof configSync === 'object' && configSync !== null ? !!configSync.GITHUB_USERNAME : false,
        hasGithubRepo: typeof configSync === 'object' && configSync !== null ? !!configSync.GITHUB_REPO : false,
        hasUploadPassword: typeof configSync === 'object' && configSync !== null ? !!configSync.UPLOAD_PASSWORD : false,
        isObject: typeof configSync === 'object' && configSync !== null
      },
      configAsyncSummary: {
        hasGithubUsername: typeof configAsync === 'object' && configAsync !== null ? !!configAsync.GITHUB_USERNAME : false,
        hasGithubRepo: typeof configAsync === 'object' && configAsync !== null ? !!configAsync.GITHUB_REPO : false,
        hasUploadPassword: typeof configAsync === 'object' && configAsync !== null ? !!configAsync.UPLOAD_PASSWORD : false,
        isObject: typeof configAsync === 'object' && configAsync !== null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('测试环境变量时出错:', error);
    // 确保即使在错误情况下也能返回响应
    try {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({
        error: error.message,
        stack: error.stack || 'No stack available',
        timestamp: new Date().toISOString()
      });
    } catch (resError) {
      // 如果响应对象也有问题，记录到控制台
      console.error('无法发送错误响应:', resError);
    }
  }
}