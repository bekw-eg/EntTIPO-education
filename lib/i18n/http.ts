import { NextResponse } from 'next/server';
import { errorText } from './messages';
import type { Locale } from './types';

export function requestLocale(request?: Request): Locale {
  const value = request?.headers.get('x-ent-locale') ?? request?.headers.get('cookie')?.match(/(?:^|;\s*)ent_tipo_locale=(ru|kk|en)(?:;|$)/)?.[1];
  return value === 'kk' || value === 'en' ? value : 'ru';
}

export function localizedJson(request: Request | undefined, data: unknown, init?: ResponseInit) {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    return NextResponse.json({ ...data, error: errorText(data.error, requestLocale(request)) }, init);
  }
  return NextResponse.json(data, init);
}
