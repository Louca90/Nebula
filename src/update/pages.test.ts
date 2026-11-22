import { describe, expect, it } from '@jest/globals';

import { MAX_PAGES, pagesFor } from './pages';

describe('pages « Quoi de neuf »', () => {
  it('une version sans page garde la popup courte', () => {
    expect(pagesFor('0.0.0')).toEqual([]);
  });

  it('4 pages au plus par version', () => {
    const page = { theme: 'conversation' as const, titre: 'nouveautes.transfertTitre' as const, texte: 'nouveautes.transfertTexte' as const };
    const many = { '2.0.0': [page, page, page, page, page, page] };
    expect(pagesFor('2.0.0', many)).toHaveLength(MAX_PAGES);
  });
});

describe('pages d’une version corrective', () => {
  const page = { theme: 'conversation' as const, titre: 'nouveautes.transfertTitre' as const, texte: 'nouveautes.transfertTexte' as const };
  const pages = { '1.9.0': [page] };

  it('reprend les pages de sa version quand elle n’en a pas', () => {
    expect(pagesFor('1.9.1', pages)).toEqual([page]);
    expect(pagesFor('1.9.0', pages)).toEqual([page]);
  });

  it('rien pour une autre version', () => {
    expect(pagesFor('1.10.0', pages)).toEqual([]);
  });
});
