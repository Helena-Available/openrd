#!/usr/bin/env python3
"""
知识库桥接服务脚本
提供与ChromaDB向量数据库的交互接口，支持搜索和统计功能
可通过命令行参数或标准输入调用
"""

import json
import sys
import argparse
from typing import Dict, Any, Optional

# 导入现有处理器
try:
    from fshd_pdf_processor import FSHDPDFProcessor
except ImportError:
    # 如果相对导入失败，尝试直接导入
    import os
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from fshd_pdf_processor import FSHDPDFProcessor


class KnowledgeBridge:
    """知识库桥接服务"""
    
    def __init__(self, chroma_db_path: str = "./chroma_db"):
        """
        初始化桥接服务
        
        Args:
            chroma_db_path: ChromaDB数据库路径
        """
        self.processor = FSHDPDFProcessor()
        # 注意：FSHDPDFProcessor内部已经固定了chroma_db路径
        # 如果需要自定义路径，可以修改处理器类或使用环境变量
    
    def search(self, question: str, n_results: int = 3, language_filter: Optional[str] = None) -> Dict[str, Any]:
        """
        搜索知识库
        
        Args:
            question: 搜索问题
            n_results: 返回结果数量
            language_filter: 语言过滤（如'en', 'zh'）
        
        Returns:
            搜索结果字典
        """
        try:
            results = self.processor.search_fshd_knowledge(
                question=question,
                n_results=n_results,
                language_filter=language_filter
            )
            
            # 转换结果格式以便JSON序列化
            formatted = {
                "success": True,
                "question": question,
                "total_results": len(results["documents"][0]) if results["documents"] else 0,
                "results": []
            }
            
            if results["documents"] and len(results["documents"][0]) > 0:
                for i in range(len(results["documents"][0])):
                    formatted["results"].append({
                        "id": results["ids"][0][i] if results["ids"] else f"result_{i}",
                        "content": results["documents"][0][i],
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "distance": results["distances"][0][i] if results.get("distances") else None
                    })
            
            return formatted
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "question": question
            }
    
    def stats(self) -> Dict[str, Any]:
        """
        获取知识库统计信息
        
        Returns:
            统计信息字典
        """
        try:
            stats = self.processor.get_collection_stats()
            return {
                "success": True,
                "stats": stats
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def health(self) -> Dict[str, Any]:
        """
        健康检查
        
        Returns:
            健康状态字典
        """
        try:
            count = self.processor.collection.count()
            return {
                "success": True,
                "status": "healthy",
                "collection": "fshd_knowledge_base",
                "total_chunks": count
            }
        except Exception as e:
            return {
                "success": False,
                "status": "unhealthy",
                "error": str(e)
            }


def main():
    """命令行入口点"""
    parser = argparse.ArgumentParser(description='知识库桥接服务')
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # search命令
    search_parser = subparsers.add_parser('search', help='搜索知识库')
    search_parser.add_argument('--question', '-q', required=True, help='搜索问题')
    search_parser.add_argument('--n_results', '-n', type=int, default=3, help='返回结果数量')
    search_parser.add_argument('--language', '-l', help='语言过滤（en/zh等）')
    
    # stats命令
    stats_parser = subparsers.add_parser('stats', help='获取知识库统计信息')
    
    # health命令
    health_parser = subparsers.add_parser('health', help='健康检查')
    
    # 从标准输入读取JSON（备用模式）
    parser.add_argument('--stdin', action='store_true', help='从标准输入读取JSON参数')
    
    args = parser.parse_args()
    
    bridge = KnowledgeBridge()
    
    if args.stdin:
        # 从标准输入读取JSON
        try:
            input_data = json.load(sys.stdin)
            command = input_data.get('command', 'search')
            
            if command == 'search':
                result = bridge.search(
                    question=input_data.get('question', ''),
                    n_results=input_data.get('n_results', 3),
                    language_filter=input_data.get('language')
                )
            elif command == 'stats':
                result = bridge.stats()
            elif command == 'health':
                result = bridge.health()
            else:
                result = {"success": False, "error": f"未知命令: {command}"}
        except json.JSONDecodeError as e:
            result = {"success": False, "error": f"JSON解析错误: {str(e)}"}
    else:
        # 命令行参数模式
        if args.command == 'search':
            result = bridge.search(
                question=args.question,
                n_results=args.n_results,
                language_filter=args.language
            )
        elif args.command == 'stats':
            result = bridge.stats()
        elif args.command == 'health':
            result = bridge.health()
        else:
            parser.print_help()
            sys.exit(1)
    
    # 输出JSON结果
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()