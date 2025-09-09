import os
import json
import argparse
import time
import requests
from datetime import datetime
from pathlib import Path
from github import Github
from github import InputGitTreeElement

# 配置目标文件和目录
MD_FILE_PATH = os.path.join("src", "upload.md")  # Markdown文件路径
UPLOAD_RECORDS = "upload_records.json"  # 上传记录JSON文件

# GitHub配置 - 这些应该从环境变量中获取
GITHUB_REPO_OWNER = os.environ.get('GITHUB_REPO_OWNER', 'your-github-username')
GITHUB_REPO_NAME = os.environ.get('GITHUB_REPO_NAME', 'your-repo-name')
GITHUB_TARGET_DIR = os.environ.get('GITHUB_TARGET_DIR', 'docs/uploads')  # GitHub上的目标目录
GITHUB_ACCESS_TOKEN = os.environ.get('GITHUB_ACCESS_TOKEN')  # GitHub访问令牌


def ensure_directory_exists(file_path):
    """确保文件所在目录存在"""
    directory = os.path.dirname(file_path)
    Path(directory).mkdir(parents=True, exist_ok=True)
    # 添加调试信息
    print(f"确保目录存在: {directory} - {'存在' if os.path.exists(directory) else '已创建'}")


def update_md_lastmod():
    """更新Markdown文件中的lastmod字段为当前时间"""
    if not os.path.exists(MD_FILE_PATH):
        print(f"MD文件不存在，无需更新lastmod: {MD_FILE_PATH}")
        return

    # 获取当前时间并格式化为lastmod要求的格式
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 读取文件内容
    with open(MD_FILE_PATH, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 查找并更新lastmod行
    updated = False
    for i, line in enumerate(lines):
        if line.startswith('lastmod:'):
            lines[i] = f'lastmod: {current_time}\n'
            updated = True
            break

    # 如果没有找到lastmod行，则添加它
    if not updated:
        for i, line in enumerate(lines):
            if line.startswith('date:'):
                lines.insert(i + 1, f'lastmod: {current_time}\n')
                updated = True
                break

    # 如果仍然没有找到合适的位置，在frontmatter末尾添加
    if not updated:
        for i, line in enumerate(lines):
            if line.strip() == '---' and i > 0:  # 找到第二个---
                lines.insert(i, f'lastmod: {current_time}\n')
                updated = True
                break

    # 写回文件
    if updated:
        with open(MD_FILE_PATH, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print(f"已更新MD文件的lastmod为: {current_time}")
    else:
        print("未能更新MD文件的lastmod字段")


def load_records():
    """加载已有的上传记录"""
    if os.path.exists(UPLOAD_RECORDS):
        file_size = os.path.getsize(UPLOAD_RECORDS)
        print(f"加载记录文件: {UPLOAD_RECORDS} (大小: {file_size} bytes)")
        with open(UPLOAD_RECORDS, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except:
                return []
    print(f"记录文件不存在，创建新列表: {UPLOAD_RECORDS}")
    return []


def save_records(new_records):
    """保存多个新的上传记录，并更新MD文件的lastmod"""
    records = load_records()

    # 处理每个新记录
    processed_records = []
    for record in new_records:
        timestamp = record['timestamp']
        # 处理带有Z后缀的ISO时间格式
        if timestamp.endswith('Z'):
            timestamp = timestamp.replace('Z', '+00:00')

        # 创建新记录
        processed_record = {
            "filename": record['filename'],
            "path": record['path'],
            "timestamp": timestamp,
            "formatted_date": datetime.fromisoformat(timestamp).strftime("%Y-%m-%d %H:%M:%S")
        }
        processed_records.append(processed_record)

    # 添加到记录列表开头（保持最新的在前面）
    records = processed_records + records

    # 保存更新后的记录
    with open(UPLOAD_RECORDS, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    # 验证保存结果
    if os.path.exists(UPLOAD_RECORDS):
        print(f"记录已保存: {UPLOAD_RECORDS} (新大小: {os.path.getsize(UPLOAD_RECORDS)} bytes)")
    else:
        print(f"警告: 记录文件未创建成功")

    # 更新MD文件中的lastmod字段
    update_md_lastmod()

    return processed_records


def update_markdown_file(new_records):
    """更新Markdown文件，批量添加新的上传记录"""
    ensure_directory_exists(MD_FILE_PATH)

    # 读取现有内容
    content = ""
    if os.path.exists(MD_FILE_PATH):
        file_size = os.path.getsize(MD_FILE_PATH)
        print(f"读取现有MD文件: {MD_FILE_PATH} (大小: {file_size} bytes)")
        with open(MD_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
    else:
        # 如果文件不存在，创建并添加标题和表格头
        print(f"MD文件不存在，创建新文件: {MD_FILE_PATH}")
        content = "# 上传文件记录\n\n"
        content += "以下是所有上传文件的记录，按上传时间倒序排列：\n\n"
        content += "| 文件名 | 上传时间 | 文件链接 | 上传人 |\n"
        content += "|--------|----------|----------|--------|\n"

    # 检查表格头是否存在，如果不存在则添加
    if "| 文件名 | 上传时间 | 文件链接 |" not in content:
        print("表格头不存在，添加表格结构")
        content += "\n| 文件名 | 上传时间 | 文件链接 | 上传人 |\n"
        content += "|--------|----------|----------|--------|\n"

    # 构建新记录行
    new_rows = []
    for record in new_records:
        new_row = f"| {record['filename']} | {record['formatted_date']} | {format_file_link(record['path'])} | |"
        new_rows.append(new_row)
        print(f"添加新记录行: {new_row.strip()}")

    # 找到表格开始位置并插入新行
    lines = content.split('\n')
    table_start_index = None

    for i, line in enumerate(lines):
        if "| 文件名 | 上传时间 | 文件链接 |" in line:
            # 表格头的下一行是分隔线，新行应该插在分隔线后面
            table_start_index = i + 2
            break

    if table_start_index is not None:
        # 批量插入所有新行
        lines[table_start_index:table_start_index] = new_rows
        print(f"插入 {len(new_rows)} 条新行到位置: {table_start_index}")
    else:
        # 如果没找到表格头，直接添加到末尾
        lines.extend(new_rows)
        print(f"未找到表格头，添加 {len(new_rows)} 条新行到文件末尾")

    # 写回文件
    updated_content = '\n'.join(lines)
    with open(MD_FILE_PATH, 'w', encoding='utf-8') as f:
        f.write(updated_content)
        f.flush()  # 强制刷新缓冲区
        os.fsync(f.fileno())  # 确保写入磁盘

    # 验证写入结果
    if os.path.exists(MD_FILE_PATH):
        new_size = os.path.getsize(MD_FILE_PATH)
        print(f"MD文件已更新: {MD_FILE_PATH} (新大小: {new_size} bytes)")
        # 验证内容是否已写入
        with open(MD_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
            missing = 0
            for row in new_rows:
                if row not in content:
                    missing += 1
            if missing == 0:
                print("所有新记录已成功写入MD文件")
            else:
                print(f"警告: 有 {missing} 条新记录未在MD文件中找到")
    else:
        print(f"错误: MD文件未创建成功")
        
    return updated_content


def format_file_link(file_path):
    """
    将文件路径转换为Markdown链接格式

    入参: 完整文件路径，如 "src/upload/assets/DHCM00001-AVE766尿机.docx"
    出参: Markdown链接，如 "[DHCM00001-AVE766尿机](assets/DHCM00001-AVE766尿机.docx)"
    处理: 路径中的空格会被转换为%20
    """
    # 分割路径，提取文件名和相对路径
    # 去掉前缀 "src/upload/"
    relative_path = file_path.replace("src/upload/", "", 1)

    # 提取文件名（不含扩展名）
    file_name = os.path.basename(file_path)
    file_name_without_ext = os.path.splitext(file_name)[0]

    # 将路径中的空格转换为%20
    encoded_path = relative_path.replace(" ", "%20")

    # 生成Markdown链接格式
    return f"[{file_name_without_ext}]({encoded_path})"


def upload_to_github(content, file_name="upload.md"):
    """
    将内容上传到GitHub仓库的指定目录
    
    参数:
    content: 要上传的文件内容
    file_name: 要在GitHub上保存的文件名
    """
    if not GITHUB_ACCESS_TOKEN:
        raise ValueError("GitHub访问令牌未配置，请设置GITHUB_ACCESS_TOKEN环境变量")
    
    try:
        # 初始化GitHub客户端
        g = Github(GITHUB_ACCESS_TOKEN)
        
        # 获取仓库
        repo = g.get_repo(f"{GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}")
        print(f"成功连接到GitHub仓库: {GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}")
        
        # 构建目标路径
        target_path = f"{GITHUB_TARGET_DIR}/{file_name}"
        print(f"准备上传文件到: {target_path}")
        
        # 检查文件是否已存在
        try:
            # 获取当前文件的SHA，用于更新
            file = repo.get_contents(target_path)
            sha = file.sha
            print(f"文件已存在，将进行更新: {target_path}")
        except:
            # 文件不存在，不需要SHA
            sha = None
            print(f"文件不存在，将创建新文件: {target_path}")
        
        # 提交文件
        commit_message = f"更新上传记录: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        response = repo.create_file(
            path=target_path,
            message=commit_message,
            content=content,
            sha=sha  # 如果是更新，需要提供当前SHA
        )
        
        print(f"文件已成功上传到GitHub: {response['content'].html_url}")
        return response
        
    except Exception as e:
        print(f"上传到GitHub失败: {str(e)}")
        raise


def main():
    parser = argparse.ArgumentParser(description='处理文件上传记录并更新Markdown文档，然后上传到GitHub')
    parser.add_argument('batch_files', help='JSON格式的批量文件信息')
    parser.add_argument('batch_timestamp', help='批量处理的时间戳')

    args = parser.parse_args()

    try:
        # 解析批量文件信息
        batch_files = json.loads(args.batch_files)
        print(f"开始处理 {len(batch_files)} 个文件")
        print(f"批量处理时间戳: {args.batch_timestamp}")

        # 为每个文件创建记录
        new_records = []
        for file_info in batch_files:
            new_record = {
                "filename": file_info["name"],
                "path": file_info["path"],
                "timestamp": args.batch_timestamp
            }
            new_records.append(new_record)

        # 保存所有记录
        processed_records = save_records(new_records)

        # 批量更新Markdown
        md_content = update_markdown_file(processed_records)
        
        # 将更新后的Markdown文件上传到GitHub
        upload_to_github(md_content)

        print(f"成功更新 {len(processed_records)} 条上传记录并上传到GitHub")
    except json.JSONDecodeError as e:
        print(f"JSON解析错误: {e}")
        exit(1)
    except Exception as e:
        print(f"处理过程出错: {e}")
        exit(1)


if __name__ == "__main__":
    main()
