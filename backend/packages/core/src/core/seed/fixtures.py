from __future__ import annotations

from dataclasses import dataclass


DEFAULT_PASSWORD = "csv2026"

SKILL_CATALOG: dict[str, list[str]] = {
    "NLP/RAG": [
        "Python",
        "RAG",
        "Vector Databases",
        "LangChain",
        "Knowledge Graphs",
        "Prompt Engineering",
        "Evaluation",
        "LLMOps",
    ],
    "AI Agent/Framework": [
        "Python",
        "TypeScript",
        "Agent Design",
        "Tool Calling",
        "LangGraph",
        "MCP",
        "Workflow Orchestration",
        "OpenAI SDK",
    ],
    "Data Analysis/ML": [
        "Python",
        "SQL",
        "Pandas",
        "Statistics",
        "Feature Engineering",
        "Model Training",
        "Experiment Tracking",
        "XGBoost",
    ],
    "Computer Vision": [
        "Python",
        "Computer Vision",
        "PyTorch",
        "OpenCV",
        "Multimodal Models",
        "Model Serving",
        "Data Labeling",
        "CUDA",
    ],
    "Prompt Engineering": [
        "Prompt Engineering",
        "Evaluation",
        "Guardrails",
        "Conversation Design",
        "Anthropic API",
        "OpenAI SDK",
        "A/B Testing",
        "Prompt Testing",
    ],
    "Fine-tuning/Training": [
        "Python",
        "PyTorch",
        "Fine-Tuning",
        "LoRA",
        "Distributed Training",
        "GPU Optimization",
        "Datasets",
        "Model Evaluation",
    ],
    "Full-stack+AI": [
        "TypeScript",
        "React",
        "Next.js",
        "PostgreSQL",
        "Redis",
        "API Design",
        "Python",
        "Tool Calling",
    ],
}

FAMILY_NAMES = [
    "张",
    "李",
    "王",
    "刘",
    "陈",
    "杨",
    "赵",
    "黄",
    "周",
    "吴",
]

GIVEN_NAMES = [
    "安然",
    "北辰",
    "成蹊",
    "初夏",
    "东篱",
    "方圆",
    "光年",
    "海宁",
    "嘉木",
    "景行",
    "可心",
    "临风",
    "慕言",
    "南乔",
    "沛然",
    "清和",
    "若溪",
    "书航",
    "听澜",
    "望舒",
    "星野",
    "雅宁",
    "以安",
    "知远",
    "子衿",
]


@dataclass(frozen=True, slots=True)
class TalentBatch:
    category: str
    count: int


TALENT_BATCHES = [
    TalentBatch(category="NLP/RAG", count=12),
    TalentBatch(category="AI Agent/Framework", count=10),
    TalentBatch(category="Data Analysis/ML", count=8),
    TalentBatch(category="Computer Vision", count=6),
    TalentBatch(category="Prompt Engineering", count=5),
    TalentBatch(category="Fine-tuning/Training", count=5),
    TalentBatch(category="Full-stack+AI", count=4),
]

ENTERPRISE_FIXTURES = [
    {"company_name": "云岚智能", "industry": "Enterprise AI", "company_size": "200-500", "ai_maturity": "scaling", "focus": "NLP/RAG"},
    {"company_name": "北辰智造", "industry": "AI Infra", "company_size": "500-1000", "ai_maturity": "advanced", "focus": "AI Agent/Framework"},
    {"company_name": "远潮数据", "industry": "Fintech", "company_size": "100-200", "ai_maturity": "adopting", "focus": "Data Analysis/ML"},
    {"company_name": "镜界科技", "industry": "Retail AI", "company_size": "50-100", "ai_maturity": "adopting", "focus": "Computer Vision"},
    {"company_name": "象限实验室", "industry": "LLM Platform", "company_size": "200-500", "ai_maturity": "scaling", "focus": "Prompt Engineering"},
    {"company_name": "灵犀训练云", "industry": "Model Training", "company_size": "500-1000", "ai_maturity": "advanced", "focus": "Fine-tuning/Training"},
    {"company_name": "潮汐应用", "industry": "SaaS", "company_size": "100-200", "ai_maturity": "scaling", "focus": "Full-stack+AI"},
    {"company_name": "山海智联", "industry": "Industrial AI", "company_size": "1000-5000", "ai_maturity": "advanced", "focus": "AI Agent/Framework"},
    {"company_name": "沧海识图", "industry": "Computer Vision", "company_size": "200-500", "ai_maturity": "scaling", "focus": "Computer Vision"},
    {"company_name": "松间分析", "industry": "Business Intelligence", "company_size": "50-100", "ai_maturity": "adopting", "focus": "Data Analysis/ML"},
    {"company_name": "星桥对话", "industry": "Customer Support AI", "company_size": "200-500", "ai_maturity": "advanced", "focus": "Prompt Engineering"},
    {"company_name": "青穹检索", "industry": "Knowledge Systems", "company_size": "100-200", "ai_maturity": "scaling", "focus": "NLP/RAG"},
    {"company_name": "矩阵智核", "industry": "AI Security", "company_size": "500-1000", "ai_maturity": "advanced", "focus": "Fine-tuning/Training"},
    {"company_name": "河图产品", "industry": "Product Studio", "company_size": "50-100", "ai_maturity": "adopting", "focus": "Full-stack+AI"},
    {"company_name": "见微数据", "industry": "Healthcare AI", "company_size": "200-500", "ai_maturity": "scaling", "focus": "Data Analysis/ML"},
]

SYSTEM_MESSAGES = [
    "个人资料完善度已更新",
    "新的岗位趋势已同步到机会图谱",
    "本周市场机会报告已生成",
    "AI 伙伴发现了新的高匹配机会",
    "技能图谱已根据最新职位刷新",
]
