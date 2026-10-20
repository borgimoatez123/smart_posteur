export interface Typography {
  fontFamily: string;
  h1: { fontSize: number; fontWeight: '700' };
  h2: { fontSize: number; fontWeight: '600' };
  h3: { fontSize: number; fontWeight: '600' };
  body: { fontSize: number; fontWeight: '400' };
  bodySmall: { fontSize: number; fontWeight: '400' };
  caption: { fontSize: number; fontWeight: '400' };
  label: { fontSize: number; fontWeight: '600' };
}

export const typography: Typography = {
  fontFamily: 'System',
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '600' },
  h3: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  bodySmall: { fontSize: 13, fontWeight: '400' },
  caption: { fontSize: 11, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
};
