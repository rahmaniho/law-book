import fs from 'node:fs/promises';
import path from 'node:path';
import ArticlePage from './article-page-client';
import { currentDataVersion } from '@/lib/server/data-version';

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

export async function generateStaticParams(): Promise<Array<{ articleId: string }>> {
  const version = await currentDataVersion();
  if (!version) return [];

  const lawsDir = path.join(process.cwd(), 'public/data/v', version, 'laws');
  const files = (await fs.readdir(lawsDir)).filter((file) => file.endsWith('.json'));
  const params: Array<{ articleId: string }> = [];

  for (const file of files) {
    const lawData = await readJson<{ articles?: Array<{ id?: string }> }>(path.join(lawsDir, file));
    for (const article of lawData?.articles ?? []) {
      if (article.id) params.push({ articleId: article.id });
    }
  }

  return params;
}

export const dynamicParams = false;
export const dynamic = 'force-static';

export default function Page() {
  return <ArticlePage />;
}

export const metadata = {
  title: 'ماده قانون | کتابچه قانون ایران',
};
