import { Injectable } from '@nestjs/common';

/**
 * GitHub からコントリビューションを取得するサービス（完成済み・触らなくてOK）
 *
 * 集計はせず、AI がそのまま分析できる生データを返す。
 * 曜日別・リポジトリ別・PRマージ率などの集計は AI に任せる。
 */

export interface Commit {
  date: string;
  weekday: string;
  repo: string;
  message: string;
}

export interface PullRequest {
  repo: string;
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

const API_BASE = 'https://api.github.com';
const PER_PAGE = 100;
// Search API は認証ありで 30回/分。コミットとPRで最大 6 リクエストに抑える
const MAX_PAGES = 3;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

@Injectable()
export class GitHubService {
  async getContributions(username: string, days = 30): Promise<Contributions> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [commitResult, prResult] = await Promise.all([
      this.search('commits', `author:${username} committer-date:>=${since}`),
      this.search('issues', `type:pr author:${username} created:>=${since}`),
    ]);

    return {
      username,
      since,
      commits: commitResult.items.map((item) => this.toCommit(item)),
      pullRequests: prResult.items.map((item) => this.toPullRequest(item)),
      truncated: commitResult.truncated || prResult.truncated,
    };
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
