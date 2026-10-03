import {Composition} from 'remotion';
import {edl} from './edl';
import {Video, VideoProps} from './Video';
import './fonts';

export const Root: React.FC = () => (
  <Composition
    id="VesperDrift"
    component={Video}
    durationInFrames={edl.totalFrames}
    fps={edl.fps}
    width={edl.width}
    height={edl.height}
    defaultProps={{mediaRes: 540} satisfies VideoProps}
  />
);
