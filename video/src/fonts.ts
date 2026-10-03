import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import {fontFiles} from './theme';

// Fonts are copied from docs/video/brand-kit/assets into public/brand-kit by `npm run prep`.
export const fontsLoaded = Promise.all(
  fontFiles.map((f) =>
    loadFont({family: f.family, url: staticFile(`brand-kit/${f.file}`), weight: String(f.weight), format: 'truetype'}),
  ),
);
