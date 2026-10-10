'use client';

import { articleHref } from './reader-routes';
import { withBase } from './base-path';
import type { Article } from './types';

/** متن آماده اشتراک‌گذاری یک ماده */
export function articleShareText(article: Article): string {
  const header = `${article.lawTitle} — ماده ${article.numberFa}`;
  const chapter = article.chapter ? `\n${article.chapter}` : '';
  return `${header}${chapter}\n\n${article.text}\n\n— کتابچه قانون ایران (جمع‌آوری و تدوین: وکیل پایه یک دادگستری لیلا آبکه)`;
}

export async function shareArticle(article: Article): Promise<'shared' | 'copied' | 'failed'> {
  const text = articleShareText(article);
  const url = deepLink(article.id);
  try {
    if (navigator.share) {
      await navigator.share({ title: `${article.lawTitle} — ماده ${article.numberFa}`, text, url });
      return 'shared';
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return 'failed';
  }
  const copied = await copyText(text);
  return copied ? 'copied' : 'failed';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export function deepLink(articleId: string): string {
  const path = withBase(articleHref(articleId));
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}
