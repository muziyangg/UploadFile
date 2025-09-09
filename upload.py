import os
import json
import argparse
import time
import requests
from datetime import datetime
from pathlib import Path
from github import Github
from github import InputGitTreeElement

# 配置目标文件和目录（本地临时文件）
# 注意：在Vercel环境中，这些文件会保存在/tmp目录下
MD_FILE_PATH = os.path.join("/tmp", "src", "upload.md")  # Markdown文件路径（使用临时目录）
UPLOAD_RECORDS = os.path.join("/tmp", "upload_records.json")  # 上传记录JSON文件（使用临时目录）

# 【文件上传仓库】配置（与JS上传的仓库保持一致）
# 这些环境变量与JS中使用的保持一致
FILE_GITHUB_REPO_OWNER = os.environ.get('GITHUB_USERNAME', '')
FILE_GITHUB_REPO_NAME = os.environ.get('GITHUB_REPO', '')
FILE_GITHUB_TARGET_DIR = os.environ.get('FILE_STORAGE_PATH', '')

# 【Markdown文档上传仓库】独立配置（新添加的独立仓库信息）
# 这些是新的环境变量，用于指定Markdown文档的目标仓库
MD_GITHUB_REPO_OWNER = os.environ.get('MD_GITHUB_REPO_OWNER', '')  # Markdown仓库所有者
MD_GITHUB_REPO_NAME = os.environ.get('MD_GITHUB_REPO_NAME', '')    # Markdown仓库名称
MD_GITHUB_TARGET_DIR = os.environ.get('MD_GITHUB_TARGET_DIR', '')  # Markdown在目标仓库中的存储目录
MD_GITHUB_ACCESS_TOKEN = os.environ.get('MD_GITHUB_ACCESS_TOKEN')  # Markdown仓库的访问令牌


def ensure_directory_exists(file_path):
    """确保文件所在目录存在"""
    directory = os.path.dirname(file_path)
    Path(directory).mkdir(parents=True, exist_ok=True)
    print(f"确保目录存在: {directory} - {'存在' if os.path.exists(directory) else '已创建'}")


def update_md_lastmod():
    """更新Markdown文件中的lastmod字段为当前时间"""
    if not os.path.exists(MD_FILE_PATH):
        print(f"MD文件不存在，无需更新lastmod: {MD_FILE_PATH}")
        return

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(MD_FILE_PATH, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    updated = False
    for i, line in enumerate(lines):
        if line.startswith('lastmod:'):
            lines[i] = f'lastmod: {current_time}\n'
            updated = True
            break

    if not updated:
        for i, line in enumerate(lines):
            if line.startswith('date:'):
                lines.insert(i + 1, f'lastmod: {current_time}\n')
                updated = True
                break

    if not updated:
        for i, line in enumerate(lines):
            if line.strip() == '---' and i > 0:
                lines.insert(i, f'lastmod: {current_time}\n')
                updated = True
                break

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

    processed_records = []
    for record in new_records:
        timestamp = record['timestamp']
        if timestamp.endswith('Z'):
            timestamp = timestamp.replace('Z', '+00:00')

        processed_record = {
            "filename": record['filename'],
            "path": record['path'],
            "timestamp": timestamp,
            "formatted_date": datetime.fromisoformat(timestamp).strftime("%Y-%m-%d %H:%M:%S")
        }
        processed_records.append(processed_record)

    records = processed_records + records

    with open(UPLOAD_RECORDS, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    if os.path.exists(UPLOAD_RECORDS):
        print(f"记录已保存: {UPLOAD_RECORDS} (新大小: {os.path.getsize(UPLOAD_RECORDS)} bytes)")
    else:
        print(f"警告: 记录文件未创建成功")

    update_md_lastmod()
    return processed_records


def update_markdown_file(new_records):
    """更新Markdown文件，批量添加新的上传记录"""
    ensure_directory_exists(MD_FILE_PATH)

    content = ""
    if os.path.exists(MD_FILE_PATH):
        file_size = os.path.getsize(MD_FILE_PATH)
        print(f"读取现有MD文件: {MD_FILE_PATH} (大小: {file_size} bytes)")
        with open(MD_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
    else:
        print(f"MD文件不存在，创建新文件: {MD_FILE_PATH}")
        content = "# 上传文件记录\n\n"
        content += "以下是所有上传文件的记录，按上传时间倒序排列：\n\n"
        content += "| 文件名 | 上传时间 | 文件链接 | 上传人 |\n"
        content += "|--------|----------|----------|--------|\n"

    if "| 文件名 | 上传时间 | 文件链接 |" not in content:
        print("表格头不存在，添加表格结构")
        content += "\n| 文件名 | 上传时间 | 文件链接 | 上传人 |\n"
        content += "|--------|----------|----------|--------|\n"

    new_rows = []
    for record in new_records:
        new_row = f"| {record['filename']} | {record['formatted_date']} | {format_file_link(record['path'])} | |"
        new_rows.append(new_row)
        print(f"添加新记录行: {new_row.strip()}")

    lines = content.split('\n')
    table_start_index = None

    for i, line in enumerate(lines):
        if "| 文件名 | 上传时间 | 文件链接 |" in line:
            table_start_index = i + 2
            break

    if table_start_index is not None:
        lines[table_start_index:table_start_index] = new_rows
        print(f"插入 {len(new_rows)} 条新行到位置: {table_start_index}")
    else:
        lines.extend(new_rows)
        print(f"未找到表格头，添加 {len(new_rows)} 条新行到文件末尾")

    updated_content = '\n'.join(lines)
    with open(MD_FILE_PATH, 'w', encoding='utf-8') as f:
        f.write(updated_content)
        f.flush()
        os.fsync(f.fileno())

    if os.path.exists(MD_FILE_PATH):
        new_size = os.path.getsize(MD_FILE_PATH)
        print(f"MD文件已更新: {MD_FILE_PATH} (新大小: {new_size} bytes)")
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
    """将文件路径转换为Markdown链接格式（指向原始文件仓库）"""
    # 链接仍指向原始文件所在的仓库（与JS上传的仓库一致）
    relative_path = file_path.replace("src/upload/", "", 1)
    file_name = os.path.basename(file_path)
    file_name_without_ext = os.path.splitext(file_name)[0]
    encoded_path = relative_path.replace(" ", "%20")
    return f"[{file_name_without_ext}]({encoded_path})"


def upload_md_to_github(content, file_name="upload.md"):
    """
    将Markdown内容上传到独立的GitHub仓库（与文件上传仓库不同）
    """
    # 验证Markdown仓库的环境变量是否配置
    if not all([MD_GITHUB_REPO_OWNER, MD_GITHUB_REPO_NAME, MD_GITHUB_ACCESS_TOKEN]):
        raise ValueError(
            "Markdown仓库配置不完整，请设置以下环境变量: "
            "MD_GITHUB_REPO_OWNER, MD_GITHUB_REPO_NAME, MD_GITHUB_ACCESS_TOKEN"
        )
    
    try:
        # 初始化Markdown仓库的GitHub客户端
        g = Github(MD_GITHUB_ACCESS_TOKEN)
        
        # 获取Markdown目标仓库
        repo = g.get_repo(f"{MD_GITHUB_REPO_OWNER}/{MD_GITHUB_REPO_NAME}")
        print(f"成功连接到Markdown目标仓库: {MD_GITHUB_REPO_OWNER}/{MD_GITHUB_REPO_NAME}")
        
        # 构建Markdown文件在目标仓库中的路径
        target_dir = MD_GITHUB_TARGET_DIR.rstrip('/') if MD_GITHUB_TARGET_DIR else ''
        target_path = f"{target_dir}/{file_name}" if target_dir else file_name
        print(f"准备上传Markdown文件到: {target_path}")
        
        # 检查文件是否已存在
        sha = None
        try:
            file = repo.get_contents(target_path)
            sha = file.sha
            print(f"Markdown文件已存在，将进行更新: {target_path}")
        except:
            print(f"Markdown文件不存在，将创建新文件: {target_path}")
        
        # 提交Markdown文件到目标仓库
        commit_message = f"更新上传记录: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        response = repo.create_file(
            path=target_path,
            message=commit_message,
            content=content,
            sha=sha
        )
        
        print(f"Markdown文件已成功上传到独立仓库: {response['content'].html_url}")
        return response
        
    except Exception as e:
        print(f"Markdown文件上传到独立仓库失败: {str(e)}")
        raise


def main():
    parser = argparse.ArgumentParser(description='处理文件上传记录并更新Markdown文档，上传到独立GitHub仓库')
    parser.add_argument('batch_files', help='JSON格式的批量文件信息')
    parser.add_argument('batch_timestamp', help='批量处理的时间戳')

    args = parser.parse_args()

    try:
        batch_files = json.loads(args.batch_files)
        print(f"开始处理 {len(batch_files)} 个文件")
        print(f"批量处理时间戳: {args.batch_timestamp}")

        new_records = []
        for file_info in batch_files:
            new_record = {
                "filename": file_info["name"],
                "path": file_info["path"],
                "timestamp": args.batch_timestamp
            }
            new_records.append(new_record)

        processed_records = save_records(new_records)
        md_content = update_markdown_file(processed_records)
        
        # 上传到Markdown独立仓库
        upload_md_to_github(md_content)

        print(f"成功更新 {len(processed_records)} 条上传记录并上传到独立仓库")
    except json.JSONDecodeError as e:
        print(f"JSON解析错误: {e}")
        exit(1)
    except Exception as e:
        print(f"处理过程出错: {e}")
        exit(1)


if __name__ == "__main__":
    main()
    