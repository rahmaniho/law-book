import LawDetailPage from './law-detail-client';
import { readVersionedJson } from '@/lib/server/data-version';

interface CatalogFile {
  laws: Array<{ id: string }>;
}

async function readCatalog(): Promise<CatalogFile> {
  return (await readVersionedJson<CatalogFile>('catalog.json')) ?? { laws: [] };
}

export async function generateStaticParams() {
  const catalog = await readCatalog();
  return catalog.laws.map((law) => ({ lawId: law.id }));
}

export const dynamicParams = false;

export default function Page() {
  return <LawDetailPage />;
}

export const dynamic = 'force-static';

export const metadata = {
  title: 'قانون | کتابچه قانون ایران',
};
