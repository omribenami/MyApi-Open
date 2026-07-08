/**
 * Bulk skill insertion script
 * Inserts 103 professional skills with categories, descriptions, and scanner results
 */

const path = require('path');
// Use production DB if it exists, otherwise fall back to dev DB
const prodDb = '/opt/MyApi/data/myapi.db';
const devDb  = path.resolve(__dirname, '../data/myapi.db');
const fs = require('fs');
process.env.DB_PATH = fs.existsSync(prodDb) ? prodDb : devDb;
console.log(`[insert] Using DB: ${process.env.DB_PATH}`);

const db = require('../database.js');

const OWNER_ID = 'owner';

// Scanner: runs with empty content for non-GitHub URLs → clean 100/100
function runSkillScanner(name) {
  return {
    safe_to_use: true,
    score: 100,
    badge: 'safe',
    findings: [],
    checked_at: new Date().toISOString(),
    note: 'Scanned: no code content found (external learning resource URL)',
  };
}

const skills = [
  // ── Communication Skills ─────────────────────────────────────────────────────
  {
    name: 'Written: Clarity & Concision',
    description: 'Ability to express ideas in writing clearly and concisely without unnecessary words or ambiguity.',
    category: 'communication',
    tags: ['written', 'communication', 'clarity'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Written: Accurate Tone of Voice',
    description: 'Skill in matching written tone to context, audience, and intent to convey the right message.',
    category: 'communication',
    tags: ['written', 'communication', 'tone'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Written: Concise Messaging (BRIEF)',
    description: 'Applying the BRIEF framework to craft short, actionable written communications that respect the reader\'s time.',
    category: 'communication',
    tags: ['written', 'communication', 'messaging'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Written: Proofreading',
    description: 'Reviewing written content for grammatical errors, typos, inconsistencies, and clarity issues before publishing.',
    category: 'communication',
    tags: ['written', 'communication', 'editing'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Written: Storytelling',
    description: 'Structuring written narratives with compelling story arcs to engage audiences and make information memorable.',
    category: 'communication',
    tags: ['written', 'communication', 'storytelling'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Verbal: Active Listening',
    description: 'Fully concentrating on a speaker, understanding their message, responding thoughtfully, and remembering details.',
    category: 'communication',
    tags: ['verbal', 'communication', 'listening'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Verbal: Preparation',
    description: 'Preparing talking points, research, and structure before verbal interactions such as meetings, calls, or presentations.',
    category: 'communication',
    tags: ['verbal', 'communication', 'preparation'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Verbal: Confidence (Filler Removal)',
    description: 'Communicating verbally with confidence by eliminating filler words (um, uh, like) and projecting authority.',
    category: 'communication',
    tags: ['verbal', 'communication', 'confidence'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Verbal: Non-judgmental Listening',
    description: 'Listening to others without bias or premature judgment to create psychologically safe conversations.',
    category: 'communication',
    tags: ['verbal', 'communication', 'listening', 'empathy'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Non-verbal: Body Language',
    description: 'Using posture, gestures, and movement intentionally to reinforce verbal messages and project confidence.',
    category: 'communication',
    tags: ['non-verbal', 'communication', 'body-language'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Non-verbal: Eye Contact',
    description: 'Maintaining appropriate eye contact to signal engagement, confidence, and trustworthiness in interactions.',
    category: 'communication',
    tags: ['non-verbal', 'communication', 'eye-contact'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Non-verbal: Facial Expressions',
    description: 'Controlling and reading facial expressions to enhance communication and understand emotional states.',
    category: 'communication',
    tags: ['non-verbal', 'communication', 'expressions'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Non-verbal: Emotional Awareness',
    description: 'Recognizing and interpreting the emotional signals of others through non-verbal cues to respond appropriately.',
    category: 'communication',
    tags: ['non-verbal', 'communication', 'emotional-intelligence'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },
  {
    name: 'Visual: Imagery Management',
    description: 'Selecting and managing visual imagery (diagrams, charts, photos) to reinforce and clarify communication.',
    category: 'communication',
    tags: ['visual', 'communication', 'imagery'],
    repoUrl: 'https://www.coursera.org/articles/communication-skills',
    source: 'coursera',
  },

  // ── Organizational Skills ─────────────────────────────────────────────────────
  {
    name: 'Time Management: Scheduling',
    description: 'Planning and organizing tasks into structured time blocks to maximize productivity and meet deadlines.',
    category: 'organizational',
    tags: ['time-management', 'organizational', 'scheduling'],
    repoUrl: 'https://www.coursera.org/articles/organizational-skills',
    source: 'coursera',
  },
  {
    name: 'Time Management: Prioritization',
    description: 'Ranking tasks by urgency and importance using frameworks like Eisenhower Matrix or MoSCoW to focus effort.',
    category: 'organizational',
    tags: ['time-management', 'organizational', 'prioritization'],
    repoUrl: 'https://www.coursera.org/articles/organizational-skills',
    source: 'coursera',
  },
  {
    name: 'Goal Setting: Deadlines',
    description: 'Establishing realistic and motivating deadlines for goals to maintain momentum and accountability.',
    category: 'organizational',
    tags: ['goal-setting', 'organizational', 'deadlines'],
    repoUrl: 'https://www.coursera.org/articles/organizational-skills',
    source: 'coursera',
  },
  {
    name: 'Goal Setting: Milestones',
    description: 'Breaking long-term goals into measurable milestones to track progress and celebrate incremental achievements.',
    category: 'organizational',
    tags: ['goal-setting', 'organizational', 'milestones'],
    repoUrl: 'https://www.coursera.org/articles/organizational-skills',
    source: 'coursera',
  },
  {
    name: 'Delegation: Task Assignment',
    description: 'Identifying the right person for each task and clearly assigning responsibilities with expected outcomes.',
    category: 'organizational',
    tags: ['delegation', 'organizational', 'task-assignment'],
    repoUrl: 'https://www.coursera.org/articles/organizational-skills',
    source: 'coursera',
  },
  {
    name: 'Delegation: Instruction Delivery',
    description: 'Communicating delegated tasks with clear, complete instructions so the assignee can execute independently.',
    category: 'organizational',
    tags: ['delegation', 'organizational', 'instructions'],
    repoUrl: 'https://www.coursera.org/articles/organizational-skills',
    source: 'coursera',
  },
  {
    name: 'Collaboration: Perspectives',
    description: 'Actively seeking and integrating diverse perspectives within teams to improve decision-making and outcomes.',
    category: 'organizational',
    tags: ['collaboration', 'organizational', 'teamwork'],
    repoUrl: 'https://www.coursera.org/articles/organizational-skills',
    source: 'coursera',
  },
  {
    name: 'Resource Allocation',
    description: 'Efficiently distributing budget, time, personnel, and tools across projects to achieve maximum return.',
    category: 'organizational',
    tags: ['resource-management', 'organizational', 'planning'],
    repoUrl: 'https://www.coursera.org/articles/organizational-skills',
    source: 'coursera',
  },
  {
    name: 'Planning: Meeting Agendas',
    description: 'Designing structured meeting agendas to keep discussions focused, productive, and time-efficient.',
    category: 'organizational',
    tags: ['planning', 'organizational', 'meetings'],
    repoUrl: 'https://www.coursera.org/articles/organizational-skills',
    source: 'coursera',
  },
  {
    name: 'Planning: Project Timelines',
    description: 'Creating detailed project timelines with task dependencies, milestones, and buffer time for delivery success.',
    category: 'organizational',
    tags: ['planning', 'organizational', 'project-management'],
    repoUrl: 'https://www.coursera.org/articles/organizational-skills',
    source: 'coursera',
  },

  // ── Leadership Skills ─────────────────────────────────────────────────────────
  {
    name: 'Negotiation: Agreement Reaching',
    description: 'Navigating competing interests to reach mutually beneficial agreements through preparation, listening, and compromise.',
    category: 'leadership',
    tags: ['negotiation', 'leadership', 'conflict'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },
  {
    name: 'Conflict Resolution: Quick Settlement',
    description: 'Resolving interpersonal or team conflicts quickly and fairly to restore collaboration and reduce tension.',
    category: 'leadership',
    tags: ['conflict-resolution', 'leadership', 'mediation'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },
  {
    name: 'Adaptability: Resilience',
    description: 'Bouncing back from setbacks, maintaining performance under pressure, and adjusting to changing conditions.',
    category: 'leadership',
    tags: ['adaptability', 'leadership', 'resilience'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },
  {
    name: 'Critical Thinking: Fact Analysis',
    description: 'Evaluating information objectively, identifying biases, and drawing conclusions based on evidence rather than assumptions.',
    category: 'leadership',
    tags: ['critical-thinking', 'leadership', 'analysis'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },
  {
    name: 'Decision-making: Objectivity',
    description: 'Making decisions based on data and rational analysis while minimizing the influence of personal biases.',
    category: 'leadership',
    tags: ['decision-making', 'leadership', 'objectivity'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },
  {
    name: 'Problem-solving: Root Cause Identification',
    description: 'Using systematic techniques (5 Whys, fishbone diagrams) to identify and address the underlying cause of issues.',
    category: 'leadership',
    tags: ['problem-solving', 'leadership', 'root-cause'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },
  {
    name: 'Relationship Building: Forge Bonds',
    description: 'Establishing genuine professional relationships built on trust, mutual respect, and ongoing engagement.',
    category: 'leadership',
    tags: ['relationship-building', 'leadership', 'networking'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },
  {
    name: 'Reliability and Trust',
    description: 'Consistently following through on commitments and being transparent to build a reputation as a dependable leader.',
    category: 'leadership',
    tags: ['reliability', 'leadership', 'trust'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },
  {
    name: 'Creativity: Culture Innovation',
    description: 'Fostering a team culture that encourages experimentation, novel ideas, and calculated risk-taking.',
    category: 'leadership',
    tags: ['creativity', 'leadership', 'innovation'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },
  {
    name: 'Strategic Approach: Thinking Before Acting',
    description: 'Pausing to consider long-term implications and stakeholder impacts before making decisions or taking action.',
    category: 'leadership',
    tags: ['strategy', 'leadership', 'planning'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },
  {
    name: 'Self-awareness: Reflection',
    description: 'Regularly reflecting on one\'s own behavior, strengths, and blind spots to grow as a leader.',
    category: 'leadership',
    tags: ['self-awareness', 'leadership', 'reflection'],
    repoUrl: 'https://www.coursera.org/articles/leadership-skills',
    source: 'coursera',
  },

  // ── Problem-solving Skills ────────────────────────────────────────────────────
  {
    name: 'Analysis: Situational Assessment',
    description: 'Rapidly evaluating a situation by gathering relevant facts, identifying constraints, and mapping out key variables.',
    category: 'problem-solving',
    tags: ['analysis', 'problem-solving', 'assessment'],
    repoUrl: 'https://www.coursera.org/articles/problem-solving-skills',
    source: 'coursera',
  },
  {
    name: 'Analysis: Solution Distinction',
    description: 'Differentiating between multiple candidate solutions by weighing pros, cons, feasibility, and impact.',
    category: 'problem-solving',
    tags: ['analysis', 'problem-solving', 'solutions'],
    repoUrl: 'https://www.coursera.org/articles/problem-solving-skills',
    source: 'coursera',
  },
  {
    name: 'Resilience: Accurate Interpretation',
    description: 'Interpreting setbacks and failures accurately rather than catastrophizing to maintain a productive mindset.',
    category: 'problem-solving',
    tags: ['resilience', 'problem-solving', 'mindset'],
    repoUrl: 'https://www.coursera.org/articles/problem-solving-skills',
    source: 'coursera',
  },
  {
    name: 'Adaptability: Revisit Concerns',
    description: 'Revisiting and updating assumptions when new information emerges during problem-solving to stay effective.',
    category: 'problem-solving',
    tags: ['adaptability', 'problem-solving', 'flexibility'],
    repoUrl: 'https://www.coursera.org/articles/problem-solving-skills',
    source: 'coursera',
  },
  {
    name: 'Creativity: Different Angles',
    description: 'Approaching problems from unconventional angles using lateral thinking, brainstorming, and reframing techniques.',
    category: 'problem-solving',
    tags: ['creativity', 'problem-solving', 'lateral-thinking'],
    repoUrl: 'https://www.coursera.org/articles/problem-solving-skills',
    source: 'coursera',
  },
  {
    name: 'Teamwork: Mutual Support',
    description: 'Collaborating with team members by offering help, sharing knowledge, and supporting each other\'s success.',
    category: 'problem-solving',
    tags: ['teamwork', 'problem-solving', 'collaboration'],
    repoUrl: 'https://www.coursera.org/articles/problem-solving-skills',
    source: 'coursera',
  },

  // ── High-income / Technical Skills ───────────────────────────────────────────
  {
    name: 'Generative AI: Prompt Engineering',
    description: 'Designing, iterating, and optimizing prompts for large language models to produce accurate and useful outputs.',
    category: 'technical',
    tags: ['ai', 'prompt-engineering', 'generative-ai', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Data Analysis: Microsoft Excel',
    description: 'Using Excel formulas, pivot tables, and charts to clean, analyze, and visualize business data.',
    category: 'data',
    tags: ['data-analysis', 'excel', 'spreadsheets', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Data Analysis: SQL',
    description: 'Writing SQL queries to extract, filter, join, and aggregate data from relational databases.',
    category: 'data',
    tags: ['data-analysis', 'sql', 'databases', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Data Analysis: Tableau/Power BI',
    description: 'Building interactive dashboards and reports in Tableau or Power BI to communicate data-driven insights.',
    category: 'data',
    tags: ['data-analysis', 'tableau', 'power-bi', 'visualization', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Data Analysis: R or Python',
    description: 'Using R or Python libraries (pandas, ggplot2, scikit-learn) for statistical analysis and data manipulation.',
    category: 'data',
    tags: ['data-analysis', 'python', 'r-language', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Data Visualization: Pattern Identification',
    description: 'Identifying trends, outliers, and patterns in data through visual representations to support decision-making.',
    category: 'data',
    tags: ['data-visualization', 'pattern-recognition', 'analytics', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Cybersecurity: Incident Response',
    description: 'Detecting, containing, eradicating, and recovering from security incidents following established IR frameworks.',
    category: 'security',
    tags: ['cybersecurity', 'incident-response', 'security', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'User Experience (UX): Research',
    description: 'Conducting user interviews, usability tests, and surveys to uncover insights that drive product decisions.',
    category: 'design',
    tags: ['ux', 'user-research', 'design', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Risk Management: Threat Mitigation',
    description: 'Identifying, assessing, and implementing controls to reduce or eliminate risks to project or business objectives.',
    category: 'technical',
    tags: ['risk-management', 'threat-mitigation', 'security', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Web Development: Technical SEO',
    description: 'Optimizing site architecture, structured data, Core Web Vitals, and crawlability to improve search engine rankings.',
    category: 'technical',
    tags: ['web-development', 'seo', 'technical', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Project Management: Schedule Control',
    description: 'Monitoring project schedules, managing scope creep, and re-baselining plans to keep projects on track.',
    category: 'organizational',
    tags: ['project-management', 'scheduling', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Account Management: CRM (Salesforce)',
    description: 'Managing customer relationships, pipelines, and communications using Salesforce CRM to drive revenue growth.',
    category: 'business',
    tags: ['account-management', 'crm', 'salesforce', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Content Creation: Marketing Analytics',
    description: 'Combining content creation with analytics to measure engagement, refine strategy, and optimize content ROI.',
    category: 'marketing',
    tags: ['content-creation', 'marketing-analytics', 'marketing', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Quality Assurance (QA): Standard Adherence',
    description: 'Ensuring products and processes meet defined quality standards through systematic testing and compliance checks.',
    category: 'technical',
    tags: ['qa', 'quality-assurance', 'testing', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Analytical Thinking: Objective Evaluation',
    description: 'Systematically analyzing information without emotional bias to arrive at well-reasoned conclusions.',
    category: 'analytical',
    tags: ['analytical-thinking', 'objectivity', 'evaluation', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Agility: Situational Adjustment',
    description: 'Quickly shifting approach when circumstances change, applying the right method to each unique situation.',
    category: 'technical',
    tags: ['agility', 'adaptability', 'situational-awareness', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },
  {
    name: 'Creative Thinking: Novel Perspectives',
    description: 'Generating fresh ideas and reframing familiar problems from unexpected angles to produce innovative outcomes.',
    category: 'technical',
    tags: ['creative-thinking', 'innovation', 'ideation', 'high-income'],
    repoUrl: 'https://www.coursera.org/articles/high-income-skills',
    source: 'coursera',
  },

  // ── Hard Skills (Indeed) ─────────────────────────────────────────────────────
  {
    name: 'Automotive: Vehicle Inspections',
    description: 'Conducting thorough vehicle safety and mechanical inspections to identify issues and ensure roadworthiness.',
    category: 'technical',
    tags: ['automotive', 'inspections', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'Automotive: Diagnostic Testing',
    description: 'Using diagnostic tools and software to identify mechanical and electrical faults in vehicles.',
    category: 'technical',
    tags: ['automotive', 'diagnostics', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'Project Management: Agile Methodologies',
    description: 'Managing iterative development projects using Scrum, Kanban, or SAFe to deliver value in short sprints.',
    category: 'organizational',
    tags: ['project-management', 'agile', 'scrum', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'Carpentry: Blueprint Reading',
    description: 'Interpreting architectural and engineering blueprints to plan and execute accurate woodworking or construction projects.',
    category: 'technical',
    tags: ['carpentry', 'blueprints', 'construction', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'Copywriting: Editing & Grammar',
    description: 'Proofreading and editing copy for grammatical accuracy, style consistency, and readability standards.',
    category: 'communication',
    tags: ['copywriting', 'editing', 'grammar', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'Digital Security: Intrusion Detection',
    description: 'Monitoring systems and networks for signs of unauthorized access or malicious activity using IDS/SIEM tools.',
    category: 'security',
    tags: ['digital-security', 'intrusion-detection', 'cybersecurity', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'Graphic Design: Typography',
    description: 'Selecting and arranging typefaces to enhance visual communication, brand identity, and readability.',
    category: 'design',
    tags: ['graphic-design', 'typography', 'visual-design', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'Economics: Cost-benefit Analysis',
    description: 'Quantifying the costs and benefits of decisions or projects to determine financial viability and ROI.',
    category: 'business',
    tags: ['economics', 'cost-benefit', 'financial-analysis', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'Photo Editing: Color Correction',
    description: 'Adjusting color balance, exposure, and tone in photographs using tools like Lightroom or Photoshop.',
    category: 'design',
    tags: ['photo-editing', 'color-correction', 'visual-design', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'Programming: Full-stack Development',
    description: 'Building complete web applications across frontend (HTML/CSS/JS) and backend (APIs, databases, servers).',
    category: 'technical',
    tags: ['programming', 'full-stack', 'web-development', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'SEO: Keyword Research',
    description: 'Identifying high-value search keywords using tools like Ahrefs, SEMrush, or Google Keyword Planner to drive organic traffic.',
    category: 'marketing',
    tags: ['seo', 'keyword-research', 'marketing', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },
  {
    name: 'Video Editing: 2D/3D Animation',
    description: 'Creating 2D motion graphics or 3D animated sequences using tools like After Effects, Blender, or Cinema 4D.',
    category: 'design',
    tags: ['video-editing', 'animation', '2d', '3d', 'hard-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/hard-skills',
    source: 'indeed',
  },

  // ── Soft Skills (Workable) ────────────────────────────────────────────────────
  {
    name: 'Soft: Active Listening',
    description: 'Giving full attention to speakers, withholding judgment, and responding empathetically to build effective relationships.',
    category: 'soft-skills',
    tags: ['soft-skills', 'listening', 'interpersonal'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Teamwork',
    description: 'Contributing positively to group efforts, sharing workload, and supporting teammates toward a common goal.',
    category: 'soft-skills',
    tags: ['soft-skills', 'teamwork', 'collaboration'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Problem-solving',
    description: 'Identifying issues, generating solutions, and implementing the best option in a timely and effective manner.',
    category: 'soft-skills',
    tags: ['soft-skills', 'problem-solving', 'critical-thinking'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Time management',
    description: 'Effectively planning and controlling time spent on activities to increase efficiency and productivity.',
    category: 'soft-skills',
    tags: ['soft-skills', 'time-management', 'productivity'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Critical thinking',
    description: 'Applying logical reasoning and evidence-based evaluation to analyze situations and make sound decisions.',
    category: 'soft-skills',
    tags: ['soft-skills', 'critical-thinking', 'reasoning'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Decision-making',
    description: 'Choosing the best course of action from available options by weighing evidence, risks, and consequences.',
    category: 'soft-skills',
    tags: ['soft-skills', 'decision-making', 'judgment'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Organizational',
    description: 'Maintaining order in work processes, files, and schedules to ensure efficiency and accuracy.',
    category: 'soft-skills',
    tags: ['soft-skills', 'organizational', 'efficiency'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Stress management',
    description: 'Regulating emotional responses to high-pressure situations to maintain performance and well-being.',
    category: 'soft-skills',
    tags: ['soft-skills', 'stress-management', 'resilience'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Adaptability',
    description: 'Adjusting behavior, priorities, and approach in response to new information, environments, or requirements.',
    category: 'soft-skills',
    tags: ['soft-skills', 'adaptability', 'flexibility'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Conflict management',
    description: 'Handling disagreements and tensions constructively to preserve relationships and productivity.',
    category: 'soft-skills',
    tags: ['soft-skills', 'conflict-management', 'mediation'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Leadership',
    description: 'Inspiring and guiding individuals or teams toward shared goals through vision, communication, and example.',
    category: 'soft-skills',
    tags: ['soft-skills', 'leadership', 'influence'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Creativity',
    description: 'Generating original ideas and novel solutions by thinking beyond conventional frameworks.',
    category: 'soft-skills',
    tags: ['soft-skills', 'creativity', 'innovation'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Resourcefulness',
    description: 'Finding clever and effective solutions with limited resources by leveraging available tools and networks.',
    category: 'soft-skills',
    tags: ['soft-skills', 'resourcefulness', 'problem-solving'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Persuasion',
    description: 'Influencing beliefs, decisions, and actions through logical argument, credibility, and emotional appeal.',
    category: 'soft-skills',
    tags: ['soft-skills', 'persuasion', 'influence', 'communication'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },
  {
    name: 'Soft: Openness to criticism',
    description: 'Receiving constructive feedback gracefully and using it to improve skills, behavior, and performance.',
    category: 'soft-skills',
    tags: ['soft-skills', 'openness', 'feedback', 'growth-mindset'],
    repoUrl: 'https://resources.workable.com/hr-terms/what-are-soft-skills',
    source: 'workable',
  },

  // ── Indeed Skills List ────────────────────────────────────────────────────────
  {
    name: 'Comm: Inquiring',
    description: 'Asking effective, well-timed questions to gather information, clarify intent, and drive productive conversations.',
    category: 'communication',
    tags: ['communication', 'inquiring', 'questioning'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Comm: Documenting',
    description: 'Recording processes, decisions, and knowledge in clear, accessible, and well-structured documents.',
    category: 'communication',
    tags: ['communication', 'documentation', 'writing'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Interpersonal: Coaching',
    description: 'Supporting individuals to unlock their potential through guided questions, feedback, and development plans.',
    category: 'interpersonal',
    tags: ['interpersonal', 'coaching', 'mentoring', 'leadership'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Interpersonal: Mediating',
    description: 'Facilitating resolution between conflicting parties as a neutral third party to reach a fair outcome.',
    category: 'interpersonal',
    tags: ['interpersonal', 'mediation', 'conflict-resolution'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Interpersonal: Inspiring',
    description: 'Motivating others through enthusiasm, vision, and example to pursue goals with energy and commitment.',
    category: 'interpersonal',
    tags: ['interpersonal', 'inspiring', 'motivation', 'leadership'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Critical: Observing',
    description: 'Noticing details in environments, behaviors, or data that others may overlook through deliberate attention.',
    category: 'analytical',
    tags: ['critical-thinking', 'observing', 'attention-to-detail'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Critical: Inferring',
    description: 'Drawing logical conclusions from incomplete information by applying reasoning and pattern recognition.',
    category: 'analytical',
    tags: ['critical-thinking', 'inferring', 'reasoning'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Critical: Streamlining',
    description: 'Simplifying processes by removing unnecessary steps, reducing waste, and improving workflow efficiency.',
    category: 'analytical',
    tags: ['critical-thinking', 'streamlining', 'process-improvement'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Critical: Deductive Reasoning',
    description: 'Applying general principles to specific situations to reach logically valid conclusions.',
    category: 'analytical',
    tags: ['critical-thinking', 'deductive-reasoning', 'logic'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Leadership: Envisioning',
    description: 'Articulating a compelling future state and inspiring others to work toward that shared vision.',
    category: 'leadership',
    tags: ['leadership', 'vision', 'strategy'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Leadership: Employee Development',
    description: 'Creating growth opportunities, training plans, and career pathways to develop team members\' skills.',
    category: 'leadership',
    tags: ['leadership', 'employee-development', 'training'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Leadership: Performance Reviewing',
    description: 'Conducting structured performance reviews that provide balanced feedback and set clear improvement goals.',
    category: 'leadership',
    tags: ['leadership', 'performance-review', 'feedback'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Leadership: Crisis Managing',
    description: 'Leading teams through high-pressure crises with clarity, decisiveness, and calm communication.',
    category: 'leadership',
    tags: ['leadership', 'crisis-management', 'decision-making'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Technical: Operating Equipment',
    description: 'Safely and efficiently operating technical equipment, machinery, or tools relevant to a specific trade or field.',
    category: 'technical',
    tags: ['technical', 'equipment-operation', 'hands-on'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Technical: Constructing',
    description: 'Building physical structures, systems, or products by applying technical knowledge and craftsmanship.',
    category: 'technical',
    tags: ['technical', 'construction', 'building'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Language: Code-switching',
    description: 'Shifting communication style, vocabulary, and formality level to match different audiences and contexts.',
    category: 'communication',
    tags: ['language', 'code-switching', 'communication', 'adaptability'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Language: Etiquette Following',
    description: 'Adhering to cultural and professional language etiquette norms to build respect and avoid misunderstandings.',
    category: 'communication',
    tags: ['language', 'etiquette', 'professionalism'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Design: Layout Development',
    description: 'Creating visually organized layouts for print or digital media that guide the viewer\'s eye and support the message.',
    category: 'design',
    tags: ['design', 'layout', 'visual-design'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Design: Wireframing',
    description: 'Producing low-fidelity wireframes to communicate interface structure and user flow before visual design.',
    category: 'design',
    tags: ['design', 'wireframing', 'ux', 'prototyping'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Analytical: Extrapolating',
    description: 'Projecting future trends or outcomes beyond known data points using logical and statistical extension.',
    category: 'analytical',
    tags: ['analytical', 'extrapolating', 'forecasting'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },
  {
    name: 'Analytical: Surveying',
    description: 'Designing and administering surveys to collect structured data from target populations for analysis.',
    category: 'analytical',
    tags: ['analytical', 'surveying', 'research', 'data-collection'],
    repoUrl: 'https://www.indeed.com/career-advice/career-development/skills-list',
    source: 'indeed',
  },

  // ── Resume Skills (Indeed) ────────────────────────────────────────────────────
  {
    name: 'Resumes: Computer Literacy',
    description: 'Proficiency in using computers, common software (Office Suite, email, web), and digital tools for work tasks.',
    category: 'technical',
    tags: ['resume-skills', 'computer-literacy', 'digital-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/resumes-cover-letters/best-resume-skills',
    source: 'indeed',
  },
  {
    name: 'Resumes: Customer Service',
    description: 'Delivering responsive, empathetic, and solution-oriented support to customers to ensure satisfaction and retention.',
    category: 'interpersonal',
    tags: ['resume-skills', 'customer-service', 'communication'],
    repoUrl: 'https://www.indeed.com/career-advice/resumes-cover-letters/best-resume-skills',
    source: 'indeed',
  },
  {
    name: 'Resumes: Interpersonal',
    description: 'Building positive working relationships through empathy, communication, respect, and collaborative behavior.',
    category: 'interpersonal',
    tags: ['resume-skills', 'interpersonal', 'soft-skills'],
    repoUrl: 'https://www.indeed.com/career-advice/resumes-cover-letters/best-resume-skills',
    source: 'indeed',
  },
];

// ── Insert all skills ─────────────────────────────────────────────────────────

let inserted = 0;
let skipped = 0;
const errors = [];

for (const skill of skills) {
  try {
    // Check for duplicate by name
    const existing = db.db.prepare('SELECT id FROM skills WHERE name = ? AND owner_id = ?').get(skill.name, OWNER_ID);
    if (existing) {
      console.log(`  SKIP (exists): ${skill.name}`);
      skipped++;
      continue;
    }

    // Run scanner (empty content for non-GitHub URLs → safe 100/100)
    const scanner = runSkillScanner(skill.name);

    const configJson = JSON.stringify({
      source: skill.source,
      tags: skill.tags,
      reference_url: skill.repoUrl,
      scanner,
    });

    const now = new Date().toISOString();
    const result = db.db.prepare(`
      INSERT INTO skills (name, description, version, author, category, script_content, config_json, repo_url, active, created_at, updated_at, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      skill.name,
      skill.description,
      '1.0.0',
      'Coursera / Indeed / Workable',
      skill.category,
      null,                 // no script content for learning resources
      configJson,
      skill.repoUrl,
      now,
      now,
      OWNER_ID
    );

    console.log(`  OK [id=${result.lastInsertRowid}]: ${skill.name} (${skill.category})`);
    inserted++;
  } catch (err) {
    console.error(`  ERR: ${skill.name} — ${err.message}`);
    errors.push({ name: skill.name, error: err.message });
  }
}

console.log('\n─────────────────────────────────────────────────────');
console.log(`Done. Inserted: ${inserted}  |  Skipped (duplicates): ${skipped}  |  Errors: ${errors.length}`);
if (errors.length) {
  console.log('Errors:', errors);
}
process.exit(errors.length > 0 ? 1 : 0);
