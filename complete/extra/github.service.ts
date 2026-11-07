import { Injectable } from '@nestjs/common';

/**
 * 「時間が余った人へ」の解答例（サービス層）
 *
 * starter/src/github/github.service.ts に、次を追加したものです。
 *   - PullRequest に number を追加（get_pull_request_detail に渡すため）
 *   - getReviews()            … 自分がレビューした PR
 *   - getRepositories()       … リポジトリ一覧
 *   - getPullRequestDetail()  … PR 1件の詳細（行数・ファイル数・コメント数）
 *
 * 方針は元のサービスと同じで、集計はせず生データを返す（集計は AI に任せる）。
 * username を省略すると、GITHUB_TOKEN の持ち主（自分）のデータを返す。
 */

export interface Commit {
  date: string;
  weekday: string;
  repo: string;
  message: string;
}

export interface PullRequest {
  repo: string;
  number: number;
  title: string;
  state: 'open' | 'merged' | 'closed';
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
}

export interface Contributions {
  username: string;
  since: string;
  commits: Commit[];
  pullRequests: PullRequest[];
  // 取得上限に達して一部しか取れていない場合 true
  truncated: boolean;
}

export interface Reviews {
  username: string;
  since: string;
  // username がレビューした、他の人の PR
  pullRequests: PullRequest[];
  truncated: boolean;
}

export interface Repository {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  isFork: boolean;
  isPrivate: boolean;
  createdAt: string;
  pushedAt: string;
}

export interface PullRequestDetail {
  repo: string;
  number: number;
  title: string;
  author: string;
  state: 'open' | 'merged' | 'closed';
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  comments: number;
  reviewComments: number;
  body: string;
}

const API_BASE = 'https://api.github.com';
const PER_PAGE = 100;
// Search API は認証ありで 30回/分。コミットとPRで最大 6 リクエストに抑える
const MAX_PAGES = 3;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

@Injectable()
export class GitHubService {
  private authenticatedLogin: string | null = null;

  async getContributions(username?: string, days = 30): Promise<Contributions> {
    const login = username || (await this.getAuthenticatedLogin());
    const since = this.sinceDate(days);

    const [commitResult, prResult] = await Promise.all([
      this.search('commits', `author:${login} committer-date:>=${since}`),
      this.search('issues', `type:pr author:${login} created:>=${since}`),
    ]);

    return {
      username: login,
      since,
      commits: commitResult.items.map((item) => this.toCommit(item)),
      pullRequests: prResult.items.map((item) => this.toPullRequest(item)),
      truncated: commitResult.truncated || prResult.truncated,
    };
  }

  // username がレビューした PR（自分の PR は除く）
  async getReviews(username?: string, days = 30): Promise<Reviews> {
    const login = username || (await this.getAuthenticatedLogin());
    const since = this.sinceDate(days);

    const result = await this.search(
      'issues',
      `type:pr reviewed-by:${login} -author:${login} created:>=${since}`,
    );

    return {
      username: login,
      since,
      pullRequests: result.items.map((item) => this.toPullRequest(item)),
      truncated: result.truncated,
    };
  }

  // 最近 push された順に最大 100 件
  async getRepositories(username?: string): Promise<Repository[]> {
    // 自分なら private も含めて取れる /user/repos、他人なら公開分だけの /users/{u}/repos
    const path = username
      ? `/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=${PER_PAGE}`
      : `/user/repos?sort=pushed&per_page=${PER_PAGE}&affiliation=owner`;

    const repos: any[] = await this.request(path);
    return repos.map((repo) => ({
      name: repo.full_name,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      isFork: repo.fork,
      isPrivate: repo.private,
      createdAt: repo.created_at,
      pushedAt: repo.pushed_at,
    }));
  }

  // repo は "owner/name" 形式
  async getPullRequestDetail(repo: string, number: number): Promise<PullRequestDetail> {
    const pr = await this.request(`/repos/${repo}/pulls/${number}`);
    return {
      repo,
      number: pr.number,
      title: pr.title,
      author: pr.user?.login,
      state: pr.merged_at ? 'merged' : pr.state,
      createdAt: pr.created_at,
      mergedAt: pr.merged_at,
      closedAt: pr.closed_at,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      commits: pr.commits,
      comments: pr.comments,
      reviewComments: pr.review_comments,
      body: (pr.body ?? '').slice(0, 500),
    };
  }

  private sinceDate(days: number): string {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  // トークンの持ち主のユーザー名。1回取ったら覚えておく
  private async getAuthenticatedLogin(): Promise<string> {
    if (!this.authenticatedLogin) {
      const user = await this.request('/user');
      this.authenticatedLogin = user.login as string;
    }
    return this.authenticatedLogin;
  }

  private toCommit(item: any): Commit {
    const date: string = item.commit.author.date;
    return {
      date,
      weekday: this.weekdayOf(date),
      repo: item.repository.full_name,
      message: item.commit.message.split('\n')[0].slice(0, 100),
    };
  }

  private toPullRequest(item: any): PullRequest {
    const mergedAt: string | null = item.pull_request?.merged_at ?? null;
    return {
      repo: item.repository_url.replace(`${API_BASE}/repos/`, ''),
      number: item.number,
      title: item.title,
      state: mergedAt ? 'merged' : item.state,
      createdAt: item.created_at,
      mergedAt,
      closedAt: item.closed_at,
    };
  }

  // コミットした人のローカル日付で曜日を出す（"2026-10-01T10:00:00+09:00" の日付部分を使う）
  private weekdayOf(isoDate: string): string {
    const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
    return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  }

  private async search(
    kind: 'commits' | 'issues',
    query: string,
  ): Promise<{ items: any[]; truncated: boolean }> {
    const items: any[] = [];
    let total = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        q: query,
        per_page: String(PER_PAGE),
        page: String(page),
      });
      const body = await this.request(`/search/${kind}?${params}`);
      total = body.total_count;
      items.push(...body.items);
      if (body.items.length < PER_PAGE) break;
    }

    return { items, truncated: items.length < total };
  }

  private async request(path: string): Promise<any> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error(
        'GITHUB_TOKEN が設定されていません。リポジトリ直下の .env を確認してください（npm run doctor で確認できます）',
      );
    }

    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'workshop-mcp',
      },
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`GitHub API エラー (${res.status}): ${detail}`);
    }
    return res.json();
  }
}
