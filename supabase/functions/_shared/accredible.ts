// Cliente Accredible API.
// Docs: https://docs.accredible.com/api

const BASE_URL = "https://api.accredible.com/v1";

function getApiKey(): string {
  const key = Deno.env.get("ACCREDIBLE_API_KEY");
  if (!key) {
    throw new Error(
      "ACCREDIBLE_API_KEY não configurada. Cole no Supabase Secrets antes de usar.",
    );
  }
  return key;
}

async function api<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<T> {
  let url = `${BASE_URL}${path}`;
  if (init?.query) {
    const params = new URLSearchParams(init.query);
    url += `?${params.toString()}`;
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      "Authorization": `Token token="${getApiKey()}"`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Accredible ${res.status} ${path}: ${text}`);
  }
  return await res.json() as T;
}

export type AccredibleGroup = {
  id: number;
  name: string;
  identifier: string;
  course_name?: string;
  course_description?: string;
};

export type AccredibleGroupsResponse = {
  groups: AccredibleGroup[];
  total_count?: number;
};

export type AccredibleCredential = {
  id: number;
  url: string;
  name: string;
  recipient: { email: string; name: string };
  group_id: number;
  issued_on: string;
};

export type AccredibleCredentialsResponse = {
  credentials: AccredibleCredential[];
  total_count?: number;
};

export async function listGroups(page = 1, pageSize = 50): Promise<AccredibleGroupsResponse> {
  return await api<AccredibleGroupsResponse>("/issuer/groups", {
    query: { page: String(page), page_size: String(pageSize) },
  });
}

export async function listAllGroups(): Promise<AccredibleGroup[]> {
  const all: AccredibleGroup[] = [];
  let page = 1;
  // segurança: máximo 20 páginas
  while (page < 20) {
    const res = await listGroups(page, 50);
    all.push(...(res.groups ?? []));
    if (!res.groups || res.groups.length < 50) break;
    page++;
  }
  return all;
}

export async function findCredentialByEmail(
  email: string,
  groupId: number,
): Promise<AccredibleCredential | null> {
  const res = await api<AccredibleCredentialsResponse>("/all_credentials", {
    query: {
      "email": email,
      "group_id": String(groupId),
      "full_view": "true",
    },
  });
  return res.credentials?.[0] ?? null;
}

export type CreateCredentialInput = {
  recipientName: string;
  recipientEmail: string;
  groupId: number;
  issuedOn?: string; // YYYY-MM-DD
};

export async function createCredential(
  input: CreateCredentialInput,
): Promise<AccredibleCredential> {
  const body = {
    credential: {
      group_id: input.groupId,
      recipient: {
        name: input.recipientName,
        email: input.recipientEmail,
      },
      issued_on: input.issuedOn ?? new Date().toISOString().slice(0, 10),
      // Por padrão, Accredible envia email automático.
      // A gente desabilita aqui porque vamos mandar o nosso.
      complete: true,
    },
  };
  const res = await api<{ credential: AccredibleCredential }>("/credentials", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.credential;
}
