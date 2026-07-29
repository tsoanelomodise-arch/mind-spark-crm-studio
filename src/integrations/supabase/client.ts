import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Default seed data for local fallback when Supabase credentials are not provided
const INITIAL_MOCK_DB: Record<string, any[]> = {
  prompts: [
    {
      id: "prompt-1",
      title: "Mind Map Concept Expansion",
      description: "Generates structured sub-topics and branch ideas for any mind map node.",
      content: "You are a creative strategist. Given the core concept {{concept}}, break it down into 5 distinct sub-branches with actionable bullet points:\n\n1. Branch 1\n2. Branch 2\n3. Branch 3\n4. Branch 4\n5. Branch 5",
      category: "Ideation",
      tags: ["mindmap", "brainstorming", "creative"],
      updated_at: new Date().toISOString(),
      user_id: "user-1",
      client_id: "client-1",
    },
    {
      id: "prompt-2",
      title: "Process Flow Spec Generator",
      description: "Creates comprehensive Markdown Process Flow specs with Mermaid diagrams.",
      content: "Analyze the system architecture for {{app_name}} and generate an Interactive Markdown Process Flow Spec with system routes, mermaid diagrams, and change logs.",
      category: "Documentation",
      tags: ["spec", "process-flow", "markdown"],
      updated_at: new Date().toISOString(),
      user_id: "user-1",
      client_id: "client-1",
    },
    {
      id: "prompt-3",
      title: "System Refactoring Assistant",
      description: "Optimizes component architecture, state management, and typescript types.",
      content: "Review the code snippet below and optimize for performance, clarity, and type safety:\n\n```typescript\n{{code}}\n```",
      category: "Engineering",
      tags: ["typescript", "refactoring", "code"],
      updated_at: new Date().toISOString(),
      user_id: "user-1",
      client_id: null,
    },
    {
      id: "prompt-4",
      title: "Client Onboarding Discovery Brief",
      description: "Extracts scope, goals, technical requirements, and risks from kick-off notes.",
      content: "Review the meeting notes for {{client_name}} below and produce a structured Onboarding Brief containing:\n- Core Business Objectives\n- Technical Stack & Integrations\n- Key Stakeholders\n- Primary Risks & Mitigations\n\nNotes:\n{{notes}}",
      category: "Strategy",
      tags: ["onboarding", "client", "discovery"],
      updated_at: new Date().toISOString(),
      user_id: "user-1",
      client_id: "client-1",
    },
    {
      id: "prompt-5",
      title: "AI Project Quote & Scope Estimator",
      description: "Drafts line-item cost and timeline estimates based on project deliverables.",
      content: "Create a formal project quote for {{project_name}} given budget target {{budget}} and completion target {{completion_date}}. Break down phases, deliverables, and assumptions.",
      category: "Sales",
      tags: ["quote", "estimate", "pricing"],
      updated_at: new Date().toISOString(),
      user_id: "user-1",
      client_id: "client-2",
    },
    {
      id: "prompt-6",
      title: "Weekly CRM & Pipeline Summarizer",
      description: "Generates high-level status updates and blocker alerts for standups.",
      content: "Summarize active projects for client {{client_name}} during the week of {{week_date}}. Highlight completed milestones, active tasks, and flagged blockers.",
      category: "Management",
      tags: ["crm", "status", "weekly"],
      updated_at: new Date().toISOString(),
      user_id: "user-1",
      client_id: "client-1",
    },
  ],
  clients: [
    {
      id: "client-1",
      name: "Mindweave Labs",
      email: "contact@mindweave.io",
      industry: "Software & AI",
      created_at: new Date().toISOString(),
    },
    {
      id: "client-2",
      name: "Apex Design Co",
      email: "hello@apexdesign.com",
      industry: "Visual & Motion Design",
      created_at: new Date().toISOString(),
    }
  ],
  projects: [
    {
      id: "proj-1",
      name: "Mind Spark Studio Integration",
      client_id: "client-1",
      status: "work_in_progress",
      impl_stage: "kickoff",
      stage: "active",
      type: "WEB",
      value: 25000,
      start_date: "2026-07-01",
      target_date: "2026-08-15",
      due_date: "2026-08-15",
      notes: "Integrating Prompt Palace Pro with Mindweave canvas",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "proj-2",
      name: "Prompt Taxonomy Engine",
      client_id: "client-2",
      status: "work_in_progress",
      impl_stage: "build",
      stage: "active",
      type: "Design",
      value: 12000,
      start_date: "2026-08-01",
      target_date: "2026-09-01",
      due_date: "2026-08-20",
      notes: "Designing custom prompt categorizers and tags",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "proj-3",
      name: "AI Knowledge Graph Search",
      client_id: "client-1",
      status: "work_in_progress",
      impl_stage: "qa",
      stage: "active",
      type: "AI & ML",
      value: 38000,
      start_date: "2026-06-15",
      target_date: "2026-08-01",
      due_date: "2026-07-30",
      notes: "Indexing multi-tenant vector databases for real-time query retrieval",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "proj-4",
      name: "Omnichannel Automated Workflow",
      client_id: "client-2",
      status: "work_in_progress",
      impl_stage: "launch",
      stage: "active",
      type: "Automation",
      value: 18500,
      start_date: "2026-07-10",
      target_date: "2026-08-05",
      due_date: "2026-08-05",
      notes: "Webhook automation across Slack, HubSpot, and Google Workspace",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "proj-rec-1",
      name: "Monthly Architecture & Mind Map Review",
      client_id: "client-1",
      status: "active",
      impl_stage: "kickoff",
      stage: "active",
      type: "WEB",
      value: 8500,
      repeat_interval: "monthly",
      next_occurrence_date: "2026-08-01",
      due_date: "2026-08-01",
      notes: "Monthly architecture review and system health audit for Mindweave Labs",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "proj-rec-2",
      name: "Weekly Security & Key Vault Audit",
      client_id: "client-2",
      status: "active",
      impl_stage: "build",
      stage: "active",
      type: "Security",
      value: 3200,
      repeat_interval: "weekly",
      next_occurrence_date: "2026-08-05",
      due_date: "2026-08-05",
      notes: "Weekly access control check & credential encryption validation for Apex Design",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  credentials: [
    {
      id: "cred-1",
      client_id: "client-1",
      label: "Mindweave Production Portal",
      system: "WordPress",
      url: "https://mindweave.io/wp-admin",
      username: "admin@mindweave.io",
      notes: "Main CMS login for client portal updates and blog posts.",
      last_rotated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: "cred-2",
      client_id: "client-1",
      label: "AWS Staging Vault",
      system: "AWS IAM",
      url: "https://console.aws.amazon.com",
      username: "mindweave-dev-admin",
      notes: "2FA active via Studio Authenticator app.",
      last_rotated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: "cred-3",
      client_id: "client-2",
      label: "Apex Figma Workspace",
      system: "Figma",
      url: "https://figma.com/@apexdesign",
      username: "design@apexdesign.com",
      notes: "Enterprise tier workspace access token in notes.",
      last_rotated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ],
  credential_secrets: {
    "cred-1": "Mw#88!vP$92026",
    "cred-2": "aWs_Staging_K3y_2026!",
    "cred-3": "FgMa_Design_Vault_99!",
  },
  wiki_spaces: [
    {
      id: "space-1",
      name: "Studio Architecture",
      slug: "studio-architecture",
      description: "Core technical guides, process specs, and system blueprints.",
      created_at: new Date().toISOString(),
    },
    {
      id: "space-2",
      name: "Prompt Playbooks",
      slug: "prompt-playbooks",
      description: "Best practices and prompt engineering patterns.",
      created_at: new Date().toISOString(),
    },
  ],
  wiki_pages: [
    {
      id: "page-1",
      space_id: "space-1",
      space_slug: "studio-architecture",
      slug: "system-overview",
      title: "System Architecture & Process Flow",
      body: "# Mind Spark Studio & Prompt Palace Pro\n\nWelcome to the unified canvas and prompt studio system.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  team_members: [
    {
      id: "team-1",
      user_id: "user-1",
      name: "Studio Architect",
      email: "architect@mindspark.studio",
      role: "admin",
      department: "Engineering",
      created_at: new Date().toISOString(),
    },
  ],
  team_directory: [
    {
      id: "dir-1",
      name: "Studio Lead",
      role: "Lead Systems Engineer",
      email: "lead@mindspark.studio",
      phone: "+1 (555) 019-2834",
      notes: "Manages mind map canvas & prompt engine integrations",
      created_at: new Date().toISOString(),
    },
  ],
  project_credentials: [
    {
      id: "cred-1",
      project_id: "proj-1",
      service_name: "AI Studio Gateway",
      username: "admin@mindspark.studio",
      password_hash: "encrypted-vault-key",
      created_at: new Date().toISOString(),
    },
  ],
  recurring_projects: [
    {
      id: "rec-1",
      title: "Monthly Mind Map Architecture Review",
      client_id: "client-1",
      repeat_interval: "monthly",
      next_due_at: "2026-08-01",
      created_at: new Date().toISOString(),
    },
  ],
  contacts: [],
  client_notes: [],
  client_conversations: [],
  project_stages: [],
  project_tasks: [
    {
      id: "task-101",
      project_id: "proj-1",
      title: "Kickoff call & technical architecture review",
      description: "Review system bounds and confirm deployment environments",
      status: "done",
      assignee_id: "dir-1",
      due_date: "2026-07-10",
      position: 1,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "task-102",
      project_id: "proj-1",
      title: "Design mind map API request schemas",
      description: "Specify JSON request/response formats for AI canvas sync",
      status: "doing",
      assignee_id: "dir-1",
      due_date: "2026-07-28",
      position: 2,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "task-103",
      project_id: "proj-1",
      title: "Set up staging sandbox environment",
      description: "Provision staging environment with test credentials",
      status: "todo",
      assignee_id: null,
      due_date: "2026-08-02",
      position: 3,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "task-201",
      project_id: "proj-2",
      title: "Draft taxonomy classification hierarchy",
      description: "Build category trees for engineering, product, and sales prompts",
      status: "doing",
      assignee_id: "dir-1",
      due_date: "2026-07-29",
      position: 1,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "task-202",
      project_id: "proj-2",
      title: "Fix tag collision on prompt clone",
      description: "Ensure tags are deduplicated during prompt copying",
      status: "blocked",
      assignee_id: "dir-1",
      due_date: "2026-07-24",
      position: 2,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "task-203",
      project_id: "proj-2",
      title: "Build bulk tag editor component",
      description: "Allow multi-selection and bulk tag applying in UI",
      status: "todo",
      assignee_id: null,
      due_date: "2026-08-05",
      position: 3,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "task-301",
      project_id: "proj-3",
      title: "Execute vector query recall benchmarking",
      description: "Test cosine similarity search latency on 100k vectors",
      status: "doing",
      assignee_id: "dir-1",
      due_date: "2026-07-27",
      position: 1,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "task-302",
      project_id: "proj-3",
      title: "Set up automated index refresh cron job",
      description: "Daily embedding recalculation for updated documents",
      status: "todo",
      assignee_id: "dir-1",
      due_date: "2026-07-29",
      position: 2,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "task-303",
      project_id: "proj-3",
      title: "Ingest sample documentation knowledge base",
      description: "Populate test vector index with 500 tech articles",
      status: "done",
      assignee_id: "dir-1",
      due_date: "2026-07-20",
      position: 3,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "task-401",
      project_id: "proj-4",
      title: "Deploy production webhook listener cluster",
      description: "Spin up serverless runners behind load balancer",
      status: "doing",
      assignee_id: "dir-1",
      due_date: "2026-07-28",
      position: 1,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "task-402",
      project_id: "proj-4",
      title: "Run security audit & penetration test",
      description: "Verify webhook secret signatures and payload validation",
      status: "done",
      assignee_id: "dir-1",
      due_date: "2026-07-22",
      position: 2,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
  ],
  project_milestones: [],
  user_roles: [
    { user_id: "user-1", role: "admin" }
  ],
  system_changelog: []
};

let memoryMockCache: Record<string, any[]> | null = null;

function getMockStorage(): Record<string, any[]> {
  if (memoryMockCache) return memoryMockCache;
  if (typeof localStorage === "undefined") return INITIAL_MOCK_DB;
  const raw = localStorage.getItem("mind_spark_studio_mock_db");
  if (!raw) {
    localStorage.setItem("mind_spark_studio_mock_db", JSON.stringify(INITIAL_MOCK_DB));
    memoryMockCache = JSON.parse(JSON.stringify(INITIAL_MOCK_DB));
    return memoryMockCache!;
  }
  try {
    const parsed = JSON.parse(raw);
    let updated = false;

    // Filter out deleted project proj-5 / Enterprise Single Sign-On (SSO)
    if (Array.isArray(parsed.projects)) {
      const origLen = parsed.projects.length;
      parsed.projects = parsed.projects.filter(
        (p: any) => p.id !== "proj-5" && p.name !== "Enterprise Single Sign-On (SSO)"
      );
      if (parsed.projects.length !== origLen) updated = true;
    }

    if (Array.isArray(parsed.project_tasks)) {
      const origLen = parsed.project_tasks.length;
      parsed.project_tasks = parsed.project_tasks.filter((t: any) => t.project_id !== "proj-5");
      if (parsed.project_tasks.length !== origLen) updated = true;
    }

    // Ensure missing table arrays/objects are defined
    for (const key of Object.keys(INITIAL_MOCK_DB)) {
      if (Array.isArray(INITIAL_MOCK_DB[key])) {
        if (!parsed[key] || !Array.isArray(parsed[key])) {
          parsed[key] = [...INITIAL_MOCK_DB[key]];
          updated = true;
        }
      } else if (typeof INITIAL_MOCK_DB[key] === "object") {
        if (!parsed[key] || typeof parsed[key] !== "object") {
          parsed[key] = { ...INITIAL_MOCK_DB[key] };
          updated = true;
        }
      }
    }

    // Seed credentials if empty
    if (Array.isArray(parsed.credentials) && parsed.credentials.length === 0 && Array.isArray(INITIAL_MOCK_DB.credentials)) {
      parsed.credentials = [...INITIAL_MOCK_DB.credentials];
      parsed.credential_secrets = { ...(INITIAL_MOCK_DB.credential_secrets || {}) };
      updated = true;
    }

    // Seed/merge prompts if empty or if initial prompts missing
    if (Array.isArray(parsed.prompts)) {
      if (parsed.prompts.length === 0) {
        parsed.prompts = [...INITIAL_MOCK_DB.prompts];
        updated = true;
      } else {
        for (const initP of INITIAL_MOCK_DB.prompts) {
          if (!parsed.prompts.some((p: any) => p.id === initP.id)) {
            parsed.prompts.push(initP);
            updated = true;
          }
        }
      }
    }

    // Ensure impl_stage & repeat_interval on existing projects if missing from early versions
    if (Array.isArray(parsed.projects)) {
      for (const initProj of INITIAL_MOCK_DB.projects) {
        const idx = parsed.projects.findIndex((p: any) => p.id === initProj.id);
        if (idx >= 0) {
          if (!parsed.projects[idx].impl_stage && initProj.impl_stage) {
            parsed.projects[idx] = { ...parsed.projects[idx], impl_stage: initProj.impl_stage };
            updated = true;
          }
          if (!parsed.projects[idx].repeat_interval && initProj.repeat_interval) {
            parsed.projects[idx] = { ...parsed.projects[idx], repeat_interval: initProj.repeat_interval, next_occurrence_date: initProj.next_occurrence_date };
            updated = true;
          }
        } else if (initProj.id.startsWith("proj-rec-")) {
          // Add default recurring projects if missing
          parsed.projects.push(initProj);
          updated = true;
        }
      }
    }

    if (updated) {
      localStorage.setItem("mind_spark_studio_mock_db", JSON.stringify(parsed));
    }

    memoryMockCache = parsed;
    return memoryMockCache!;
  } catch {
    memoryMockCache = JSON.parse(JSON.stringify(INITIAL_MOCK_DB));
    return memoryMockCache!;
  }
}

function saveMockStorage(db: Record<string, any[]>) {
  memoryMockCache = db;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("mind_spark_studio_mock_db", JSON.stringify(db));
  }
}

// Chainable builder for local storage mock query proxy
function createMockQuery(tableName: string) {
  let filterFn = (row: any) => true;
  let sortFn: ((a: any, b: any) => number) | null = null;
  let isSingle = false;
  let isMaybeSingle = false;
  let pendingMutation: { type: "insert" | "upsert" | "update" | "delete"; data?: any } | null = null;

  const getTable = () => {
    const db = getMockStorage();
    return db[tableName] || [];
  };

  const builder: any = {
    select: (fields?: string) => builder,
    order: (field: string, { ascending = true }: { ascending?: boolean } = {}) => {
      const prevSort = sortFn;
      sortFn = (a: any, b: any) => {
        const valA = a[field] ?? "";
        const valB = b[field] ?? "";
        const res = valA > valB ? 1 : valA < valB ? -1 : 0;
        return ascending ? res : -res;
      };
      return builder;
    },
    eq: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && row[field] === value;
      return builder;
    },
    neq: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => {
        if (!prev(row)) return false;
        const val = row[field];
        if (value === "none" && (val === undefined || val === null || val === "none")) return false;
        return val !== value;
      };
      return builder;
    },
    gte: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && row[field] >= value;
      return builder;
    },
    gt: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && row[field] > value;
      return builder;
    },
    lte: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && row[field] <= value;
      return builder;
    },
    lt: (field: string, value: any) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && row[field] < value;
      return builder;
    },
    in: (field: string, values: any[]) => {
      const prev = filterFn;
      filterFn = (row: any) => prev(row) && Array.isArray(values) && values.includes(row[field]);
      return builder;
    },
    ilike: (field: string, pattern: string) => {
      const prev = filterFn;
      const cleanPattern = pattern.replace(/%/g, "").toLowerCase();
      filterFn = (row: any) => prev(row) && String(row[field] || "").toLowerCase().includes(cleanPattern);
      return builder;
    },
    or: (condition: string) => {
      const prev = filterFn;
      const parts = condition.split(",").map((p) => p.trim());
      filterFn = (row: any) => {
        if (!prev(row)) return false;
        return parts.some((part) => {
          if (part.includes(".ilike.")) {
            const [field, val] = part.split(".ilike.");
            const cleanPattern = (val || "").replace(/%/g, "").toLowerCase();
            return String(row[field] || "").toLowerCase().includes(cleanPattern);
          }
          if (part.includes(".eq.")) {
            const [field, val] = part.split(".eq.");
            return String(row[field] ?? "") === val;
          }
          if (part.includes(".neq.")) {
            const [field, val] = part.split(".neq.");
            return String(row[field] ?? "") !== val;
          }
          return true;
        });
      };
      return builder;
    },
    is: (field: string, val: any) => {
      const prev = filterFn;
      filterFn = (row: any) =>
        prev(row) &&
        (val === null ? row[field] === null || row[field] === undefined : row[field] === val);
      return builder;
    },
    limit: (n: number) => builder,
    single: () => {
      isSingle = true;
      return builder;
    },
    maybeSingle: () => {
      isMaybeSingle = true;
      return builder;
    },
    insert: (data: any | any[]) => {
      pendingMutation = { type: "insert", data };
      return builder;
    },
    upsert: (data: any | any[]) => {
      pendingMutation = { type: "upsert", data };
      return builder;
    },
    update: (data: any) => {
      pendingMutation = { type: "update", data };
      return builder;
    },
    delete: () => {
      pendingMutation = { type: "delete" };
      return builder;
    },
    then: (resolve: Function, reject: Function) => {
      try {
        const db = getMockStorage();
        const list = db[tableName] || [];

        if (pendingMutation?.type === "insert") {
          const data = pendingMutation.data;
          const newItems = Array.isArray(data) ? data : [data];
          const inserted = newItems.map((item) => ({
            id: item.id || `${tableName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item,
          }));
          db[tableName] = [...list, ...inserted];
          saveMockStorage(db);

          const resultData = (isSingle || isMaybeSingle)
            ? (inserted[0] || null)
            : (Array.isArray(data) ? inserted : inserted[0]);

          resolve({ data: resultData, error: null });
          return;
        }

        if (pendingMutation?.type === "upsert") {
          const data = pendingMutation.data;
          const items = Array.isArray(data) ? data : [data];
          const updatedList = [...list];
          const resItems: any[] = [];

          for (const item of items) {
            const id = item.id || `${tableName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const idx = updatedList.findIndex((r) => r.id === id);
            const merged = {
              id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...item,
            };
            if (idx >= 0) {
              updatedList[idx] = { ...updatedList[idx], ...merged };
              resItems.push(updatedList[idx]);
            } else {
              updatedList.push(merged);
              resItems.push(merged);
            }
          }
          db[tableName] = updatedList;
          saveMockStorage(db);

          const resultData = (isSingle || isMaybeSingle)
            ? (resItems[0] || null)
            : (Array.isArray(data) ? resItems : resItems[0]);

          resolve({ data: resultData, error: null });
          return;
        }

        if (pendingMutation?.type === "update") {
          const data = pendingMutation.data;
          const updatedRows: any[] = [];
          const updatedList = list.map((row) => {
            if (filterFn(row)) {
              const updated = { ...row, ...data, updated_at: new Date().toISOString() };
              updatedRows.push(updated);
              return updated;
            }
            return row;
          });
          db[tableName] = updatedList;
          saveMockStorage(db);

          const resultData = (isSingle || isMaybeSingle)
            ? (updatedRows[0] || null)
            : (updatedRows.length === 1 ? updatedRows[0] : updatedRows);

          resolve({ data: resultData, error: null });
          return;
        }

        if (pendingMutation?.type === "delete") {
          const deletedRows = list.filter(filterFn);
          const remaining = list.filter((row) => !filterFn(row));
          db[tableName] = remaining;
          saveMockStorage(db);

          const resultData = (isSingle || isMaybeSingle)
            ? (deletedRows[0] || null)
            : deletedRows;

          resolve({ data: resultData, error: null });
          return;
        }

        let rows = getTable().filter(filterFn);
        if (tableName === "credentials") {
          const clientsList = db.clients || [];
          rows = rows.map((r: any) => {
            if (!r.clients && r.client_id) {
              const cl = clientsList.find((c: any) => c.id === r.client_id);
              return { ...r, clients: cl ? { id: cl.id, name: cl.name } : null };
            }
            return r;
          });
        }
        if (sortFn) {
          rows = rows.sort(sortFn);
        }
        if (isSingle || isMaybeSingle) {
          const singleItem = rows[0] || null;
          resolve({ data: singleItem, error: null });
        } else {
          resolve({ data: rows, error: null });
        }
      } catch (err) {
        resolve({ data: null, error: err });
      }
    },
  };

  return builder;
}

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (
    SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    !SUPABASE_URL.includes("MY_SUPABASE")
  ) {
    return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: typeof window !== "undefined" ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  // Local storage mock proxy fallback when Supabase is not configured
  return {
    from: (table: string) => createMockQuery(table),
    rpc: async (fnName: string, args?: any) => {
      if (fnName === "has_role") return { data: true, error: null };
      if (fnName === "credential_set_secret") {
        const db = getMockStorage();
        db.credential_secrets = db.credential_secrets || {};
        if (args?._id) {
          db.credential_secrets[args._id] = args._plain ?? "";
          if (Array.isArray(db.credentials)) {
            const idx = db.credentials.findIndex((c: any) => c.id === args._id);
            if (idx >= 0) {
              db.credentials[idx].last_rotated_at = new Date().toISOString();
            }
          }
          saveMockStorage(db);
        }
        return { data: true, error: null };
      }
      if (fnName === "credential_reveal") {
        const db = getMockStorage();
        const secrets = db.credential_secrets || {};
        const credId = args?._id;

        if (credId && secrets[credId] && typeof secrets[credId] === "string" && secrets[credId].trim() !== "") {
          return { data: secrets[credId], error: null };
        }

        if (credId) {
          const creds = db.credentials || [];
          const found = creds.find((c: any) => c.id === credId);
          const cleanLabel = found?.label ? found.label.replace(/[^a-zA-Z0-9]/g, "") : "Vault";
          const fallbackSecret = `P@ss_${cleanLabel || "Vault"}_2026!`;
          secrets[credId] = fallbackSecret;
          db.credential_secrets = secrets;
          saveMockStorage(db);
          return { data: fallbackSecret, error: null };
        }

        return { data: "P@ss_Vault_2026!", error: null };
      }
      return { data: null, error: null };
    },
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user-1",
            email: "architect@mindspark.studio",
            user_metadata: { full_name: "Studio Engineer" },
          },
        },
        error: null,
      }),
      getSession: async () => ({
        data: {
          session: {
            user: {
              id: "user-1",
              email: "architect@mindspark.studio",
            },
          },
        },
        error: null,
      }),
      onAuthStateChange: (cb: Function) => {
        cb("SIGNED_IN", {
          user: { id: "user-1", email: "architect@mindspark.studio" },
        });
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: "mock-image.png" }, error: null }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80" },
        }),
      }),
    },
  } as any;
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
