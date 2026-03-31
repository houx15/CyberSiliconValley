import type { Skill, Experience } from '@/types';

export const MOCK_TALENT_PROFILE = {
  id: 'mock-talent-profile-1',
  userId: 'test-user-1',
  displayName: '陈明远',
  headline: '资深 AI 工程师 · RAG & Agent 架构',
  bio: '8年软件工程经验，近3年专注于大模型应用开发。主导过多个RAG系统和AI Agent的架构设计与落地，覆盖法律、金融、医疗等垂直领域。',
  skills: [
    { name: 'RAG Pipeline', level: 'expert', category: 'AI/ML' },
    { name: 'LangChain', level: 'expert', category: 'AI/ML' },
    { name: 'LLM Fine-tuning', level: 'advanced', category: 'AI/ML' },
    { name: 'Prompt Engineering', level: 'expert', category: 'AI/ML' },
    { name: 'Vector Databases', level: 'advanced', category: 'AI/ML' },
    { name: 'Python', level: 'expert', category: 'Languages' },
    { name: 'TypeScript', level: 'advanced', category: 'Languages' },
    { name: 'Go', level: 'intermediate', category: 'Languages' },
    { name: 'PyTorch', level: 'advanced', category: 'Frameworks' },
    { name: 'Next.js', level: 'advanced', category: 'Frameworks' },
    { name: 'FastAPI', level: 'expert', category: 'Frameworks' },
    { name: 'PostgreSQL', level: 'advanced', category: 'Data' },
    { name: 'Redis', level: 'advanced', category: 'Data' },
    { name: 'Elasticsearch', level: 'intermediate', category: 'Data' },
    { name: 'Docker', level: 'advanced', category: 'DevOps' },
    { name: 'Kubernetes', level: 'intermediate', category: 'DevOps' },
  ] satisfies Skill[],
  experience: [
    {
      company: '智谱清言',
      role: 'AI 架构师',
      duration: '2023 - 至今',
      description: '主导企业级RAG平台架构设计，日处理10万+文档检索请求。设计了多模态检索引擎，将检索准确率从72%提升至94%。管理5人AI工程团队。',
    },
    {
      company: '字节跳动',
      role: '高级算法工程师',
      duration: '2021 - 2023',
      description: '负责搜索推荐系统的NLP模块，优化了语义理解模型，使搜索相关性提升15%。参与了内部大模型预训练数据清洗流水线建设。',
    },
    {
      company: '百度',
      role: '软件工程师',
      duration: '2018 - 2021',
      description: '参与知识图谱构建与问答系统开发，负责实体识别和关系抽取模块。获得内部创新奖。',
    },
  ] satisfies Experience[],
  education: [
    {
      institution: '清华大学',
      degree: '硕士',
      field: '计算机科学与技术',
      year: '2018',
    },
    {
      institution: '北京邮电大学',
      degree: '学士',
      field: '软件工程',
      year: '2016',
    },
  ],
  goals: {
    targetRoles: ['AI 架构师', 'AI 技术总监', 'LLM 应用负责人'],
    workPreferences: ['远程优先', '技术驱动团队', '有挑战性的项目'],
  },
  availability: 'open' as const,
  salaryRange: { min: 50000, max: 80000, currency: 'CNY' },
  resumeUrl: null,
  profileData: {},
  onboardingDone: true,
  createdAt: new Date('2026-03-15'),
  updatedAt: new Date('2026-03-30'),
};

export const MOCK_ENTERPRISE_PROFILE = {
  id: 'mock-enterprise-profile-1',
  userId: 'test-enterprise-1',
  companyName: '星辰智能科技',
  industry: '人工智能',
  companySize: '200-500',
  website: 'https://stardust-ai.example.com',
  description: '星辰智能是一家专注于企业级AI解决方案的科技公司，为金融、医疗、制造业客户提供智能化转型服务。',
  aiMaturity: 'growing',
  profileData: {},
  preferences: { autoMatch: true, autoPrechat: false, dealBreakers: [] },
  onboardingDone: true,
  createdAt: new Date('2026-03-10'),
  updatedAt: new Date('2026-03-28'),
};

export const MOCK_JOBS = [
  {
    id: 'mock-job-1',
    enterpriseId: 'mock-enterprise-profile-1',
    title: '高级 RAG 工程师',
    description: '负责设计和实现企业级RAG系统，支撑公司核心AI产品。',
    structured: {
      skills: [
        { name: 'RAG Pipeline', level: 'expert', required: true },
        { name: 'Python', level: 'advanced', required: true },
        { name: 'Vector Databases', level: 'advanced', required: true },
        { name: 'LangChain', level: 'intermediate', required: false },
        { name: 'Docker', level: 'intermediate', required: false },
      ],
      seniority: 'Senior',
      timeline: 'ASAP, 长期',
      deliverables: ['RAG系统架构设计', '核心检索引擎开发', '性能优化方案'],
      budget: { min: 40000, max: 65000, currency: 'CNY' },
      workMode: 'hybrid' as const,
    },
    status: 'open',
    autoMatch: true,
    autoPrechat: false,
    createdAt: new Date('2026-03-20'),
    updatedAt: new Date('2026-03-20'),
  },
  {
    id: 'mock-job-2',
    enterpriseId: 'mock-enterprise-profile-1',
    title: 'AI Agent 开发工程师',
    description: '构建面向客户服务场景的AI Agent系统，具备多轮对话和工具调用能力。',
    structured: {
      skills: [
        { name: 'LLM Application', level: 'advanced', required: true },
        { name: 'TypeScript', level: 'advanced', required: true },
        { name: 'Prompt Engineering', level: 'advanced', required: true },
        { name: 'React', level: 'intermediate', required: false },
      ],
      seniority: 'Mid',
      timeline: 'Q2 2026, 6个月',
      deliverables: ['Agent框架搭建', '工具调用接口开发', '多轮对话管理'],
      budget: { min: 30000, max: 50000, currency: 'CNY' },
      workMode: 'remote' as const,
    },
    status: 'reviewing',
    autoMatch: true,
    autoPrechat: true,
    createdAt: new Date('2026-03-25'),
    updatedAt: new Date('2026-03-28'),
  },
  {
    id: 'mock-job-3',
    enterpriseId: 'mock-enterprise-profile-1',
    title: '数据标注平台产品经理',
    description: '负责AI数据标注平台的产品规划和迭代，提升标注效率和质量。',
    structured: {
      skills: [
        { name: 'Product Management', level: 'advanced', required: true },
        { name: 'AI/ML Understanding', level: 'intermediate', required: true },
        { name: 'Data Annotation', level: 'intermediate', required: false },
      ],
      seniority: 'Senior',
      timeline: '2026年4月, 长期',
      deliverables: ['产品路线图', '需求文档', '用户研究报告'],
      budget: { min: 35000, max: 55000, currency: 'CNY' },
      workMode: 'onsite' as const,
    },
    status: 'open',
    autoMatch: false,
    autoPrechat: false,
    createdAt: new Date('2026-03-28'),
    updatedAt: new Date('2026-03-28'),
  },
];

export const MOCK_JOB_MATCH_COUNTS: Record<string, { matchCount: number; shortlistedCount: number }> = {
  'mock-job-1': { matchCount: 23, shortlistedCount: 5 },
  'mock-job-2': { matchCount: 15, shortlistedCount: 3 },
  'mock-job-3': { matchCount: 8, shortlistedCount: 1 },
};

export const MOCK_COMPANION_COUNTS = {
  matchCount: 4,
  inboxCount: 2,
};
